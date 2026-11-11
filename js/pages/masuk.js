const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);

// Tujuan setelah login: hanya nama file .html lokal (mencegah pengalihan ke situs lain)
const nextParam = params.get("next") || "";
const next = /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(nextParam)
  ? nextParam
  : "index.html";

function pesan(teks, jenis = "error") {
  const el = $("#msg");
  el.textContent = teks;
  el.className = "auth-msg " + jenis;
  el.hidden = !teks;
}

// Judul dan keterangan di atas formulir untuk tiap mode
const JUDUL = {
  masuk: [
    "Selamat datang kembali!",
    "Masuk untuk menyimpan favorit dan menghubungi pemilik kos.",
  ],
  daftar: [
    "Buat akun baru",
    "Daftar gratis untuk mulai menyimpan kos favorit Anda.",
  ],
};

function setTab(nama) {
  $("#authTitle").textContent = JUDUL[nama][0];
  $("#authSub").textContent = JUDUL[nama][1];
  $("#formMasuk").hidden = nama !== "masuk";
  $("#formDaftar").hidden = nama !== "daftar";
  pesan("");
}

function terjemah(err) {
  const m = ((err && err.message) || "").toLowerCase();
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
    location.replace(next);
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
      pemilik: f.elements.pemilik.checked,
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
Auth.session().then((s) => {
  if (s) location.replace(next);
});