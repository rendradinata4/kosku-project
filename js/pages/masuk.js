const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);

// Tujuan setelah login: hanya nama file .html lokal (mencegah pengalihan ke situs lain)
const nextParam = params.get("next") || "";
const nextValid = /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(nextParam);

// Satu halaman untuk dua peran: "pencari" (awal) atau "pemilik". Bisa dibuka langsung
// sebagai pemilik lewat masuk.html?peran=pemilik
let peran = params.get("peran") === "pemilik" ? "pemilik" : "pencari";
let tab = "masuk"; // "masuk" atau "daftar"

// Tujuan setelah login: "next" bila ada, jika tidak sesuai peran akun
function tujuan(role) {
  if (nextValid) return nextParam;
  if (role === "pemilik") return "dashboard.html";
  if (role === "admin") return "admin.html";
  return "index.html";
}

function pesan(teks, jenis = "error") {
  const el = $("#msg");
  el.textContent = teks;
  el.className = "auth-msg " + jenis;
  el.hidden = !teks;
}

// Judul dan keterangan di atas formulir untuk tiap peran dan mode
const JUDUL = {
  pemilik: {
    masuk: [
      "Masuk ke dashboard pemilik",
      "Kelola kos, kamar, dan harga Anda di satu tempat.",
    ],
    daftar: [
      "Daftar sebagai pemilik kos",
      "Buat akun pemilik untuk mulai memasang kos Anda.",
    ],
  },
  pencari: {
    masuk: [
      "Selamat datang kembali!",
      "Masuk untuk menyimpan favorit dan menghubungi pemilik kos.",
    ],
    daftar: [
      "Buat akun baru",
      "Daftar gratis untuk mulai menyimpan kos favorit Anda.",
    ],
  },
};

function setTab(nama) {
  tab = nama;
  $("#authTitle").textContent = JUDUL[peran][nama][0];
  $("#authSub").textContent = JUDUL[peran][nama][1];
  $("#formMasuk").hidden = nama !== "masuk";
  $("#formDaftar").hidden = nama !== "daftar";
  pesan("");
}

// Ganti peran. Atribut data-peran memicu animasi geser (CSS); teks formulir diganti
// di tengah animasi, saat kotak formulir sedang memudar.
let timerGanti;
function setPeran(baru, animasi = true) {
  if (baru === peran && document.body.dataset.peran === baru) return;
  peran = baru;
  document.body.dataset.peran = baru;
  document.querySelectorAll(".role-btn").forEach((b) =>
    b.setAttribute("aria-selected", b.dataset.peran === baru),
  );
  const ganti = () => {
    document.body.dataset.isi = baru;
    setTab(tab);
    $("#authBox").classList.remove("fading");
  };
  clearTimeout(timerGanti);
  if (!animasi) return ganti();
  $("#authBox").classList.add("fading");
  timerGanti = setTimeout(ganti, 250);
}

function terjemah(err) {
  const m = ((err && err.message) || "").toLowerCase();
  if (m.includes("role-pencari"))
    return "Akun ini terdaftar sebagai pencari kos. Pilih tab Pencari Kos di atas untuk masuk, atau daftar akun pemilik baru.";
  if (m.includes("invalid login")) return "Email atau password salah.";
  if (m.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Cek kotak masuk email Anda.";
  if (m.includes("already registered"))
    return "Email ini sudah terdaftar. Silakan masuk.";
  if (m.includes("at least 6")) return "Password minimal 6 karakter.";
  if (m.includes("not authorized"))
    return "Email ini belum diizinkan oleh layanan email bawaan Supabase (mode pengembangan). Gunakan email anggota tim Supabase, atau atur SMTP kustom.";
  if (m.includes("rate limit"))
    return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
  return "Terjadi kesalahan: " + ((err && err.message) || "coba lagi.");
}

// Kirim form dengan tombol dinonaktifkan selama proses
async function kirim(form, aksi) {
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  pesan("");
  try {
    await aksi();
  } catch (err) {
    pesan(terjemah(err));
  } finally {
    btn.disabled = false;
  }
}

document
  .querySelectorAll(".auth-tab")
  .forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

// Tombol Lihat/Sembunyikan password
document.querySelectorAll(".pw-toggle").forEach((b) =>
  b.addEventListener("click", () => {
    const input = b.previousElementSibling; // kolom password di sebelahnya
    const tampil = input.type === "password";
    input.type = tampil ? "text" : "password";
    b.textContent = tampil ? "Sembunyikan" : "Lihat";
  }),
);

$("#formMasuk").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  kirim(f, async () => {
    await Auth.signIn(f.elements.email.value.trim(), f.elements.password.value);
    const p = await Auth.profile();
    // Halaman pemilik hanya untuk akun pemilik (atau admin)
    if (peran === "pemilik" && p && p.role === "pencari") {
      await Auth.signOut();
      throw new Error("role-pencari");
    }
    location.replace(tujuan(p && p.role));
  });
});

$("#formDaftar").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  kirim(f, async () => {
    const data = await Auth.signUp({
      nama: f.elements.nama.value.trim(),
      email: f.elements.email.value.trim(),
      password: f.elements.password.value,
      noTelepon: f.elements.telepon.value.trim(),
      pemilik: peran === "pemilik", // daftar lewat mode pemilik = akun pemilik
    });
    // Jika konfirmasi email dimatikan, Supabase langsung membuat sesi. Kita keluarkan lagi
    // agar pengguna masuk sendiri lewat tab Masuk.
    const email = f.elements.email.value.trim();
    if (data.session) await Auth.signOut();
    setTab("masuk");
    $("#formMasuk").elements.email.value = email;
    $("#formMasuk").elements.password.focus();
    pesan(
      data.session
        ? "Pendaftaran berhasil. Silakan masuk dengan akun Anda."
        : "Pendaftaran berhasil. Kami mengirim email konfirmasi. Buka email Anda, lalu masuk di sini.",
      "ok",
    );
  });
});

// Sudah login: tidak perlu melihat halaman ini
// Pilihan peran + keadaan awal (tanpa animasi saat halaman dibuka)
document.querySelectorAll(".role-btn").forEach((b) =>
  b.addEventListener("click", () => setPeran(b.dataset.peran)),
);
setPeran(peran, false);
requestAnimationFrame(() => $("#authCard").classList.add("ready")); // nyalakan transisi setelah tampilan awal

Auth.profile().then((p) => {
  if (p) location.replace(tujuan(p.role));
});