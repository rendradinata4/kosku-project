// Autentikasi: sesi, profil, keluar, dan navbar.
// PENTING: pengecekan peran di front-end hanya untuk kenyamanan tampilan.
// Keamanan yang sebenarnya dijaga RLS di database (tahap 4 bagian 1).

const ROLE_LABEL = { pencari: "Pencari", pemilik: "Pemilik", admin: "Admin" };

// Escape teks dari pengguna sebelum dimasukkan ke innerHTML (mencegah XSS)
const esc = (t) =>
  String(t ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const Auth = {
  async session() {
    const { data } = await db.auth.getSession();
    return data.session;
  },

  // Profil pengguna yang sedang login: { id, email, nama, role } atau null
  async profile() {
    const s = await this.session();
    if (!s) return null;
    const { data, error } = await db
      .from("profiles")
      .select("nama, role")
      .eq("id", s.user.id)
      .single();
    if (error || !data) return null;
    return { id: s.user.id, email: s.user.email, ...data };
  },

  async signIn(email, password) {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signUp({ nama, email, password, noTelepon, pemilik }) {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          nama,
          no_telepon: noTelepon,
          role: pemilik ? "pemilik" : "pencari",
        },
        // Tautan di email konfirmasi membawa pengguna kembali ke situs tempat ia mendaftar
        // (lokal atau Vercel). Alamatnya harus ada di daftar Redirect URLs Supabase.
        emailRedirectTo: new URL("index.html", location.href).href,
      },
    });
    if (error) throw error;
    return data; // data.session kosong jika konfirmasi email aktif
  },

  async signOut() {
    await db.auth.signOut();
  },

  // Penjaga halaman: pakai di halaman dashboard, mis. Auth.require(["pemilik"])
  // Hasil: profil jika boleh; null jika belum login (pengguna dialihkan ke halaman masuk);
  // { ...profil, ditolak: true } jika sudah login tetapi perannya tidak sesuai.
  async require(roles) {
    const p = await this.profile();
    if (!p) {
      const kembali = location.pathname.split("/").pop() + location.search;
      location.href = "masuk.html?next=" + encodeURIComponent(kembali);
      return null;
    }
    return roles.includes(p.role) ? p : { ...p, ditolak: true };
  },
};

// Navbar: tombol Masuk, atau nama + peran + tombol Keluar
async function renderAuthNav() {
  const el = document.getElementById("authNav");
  if (!el) return;
  const p = await Auth.profile();
  if (!p) {
    el.innerHTML = '<a class="auth-btn" href="masuk.html">Masuk</a>';
    return;
  }
  const dashboard =
    p.role === "pemilik"
      ? '<a class="auth-btn ghost" href="dashboard.html">Dashboard</a>'
      : p.role === "admin"
        ? '<a class="auth-btn ghost" href="admin.html">Admin</a>'
        : "";
  el.innerHTML =
    `<span class="auth-user" title="${esc(p.email)}">${icon("account_circle")}` +
    `<span class="auth-name">${esc(p.nama)}</span><small>${esc(ROLE_LABEL[p.role] || p.role)}</small></span>` +
    dashboard +
    '<button type="button" class="auth-btn ghost" id="btnKeluar">Keluar</button>';
  document.getElementById("btnKeluar").addEventListener("click", async () => {
    await Auth.signOut();
    location.reload();
  });
}

renderAuthNav();

// ===== Penjaga aksi khusus pengguna yang sudah login =====
// Aksi terlindungi: tombol favorit, tombol WhatsApp, dan tautan/tab Favorit.
const SELECTOR_TERLINDUNGI = [
  ".btn-fav", // tombol hati di kartu halaman Cari
  ".heart", // tombol hati di kartu beranda
  "#favTop", // tombol hati di halaman detail
  "#favBand", // pita "Simpan ke Favorit" di halaman detail
  "#favChip", // chip filter Favorit di halaman Cari
  ".btn-wa", // tombol WhatsApp besar (detail)
  ".btn-wa-mini", // tombol WhatsApp kecil (kartu)
  'a[href*="favorit.html"]', // tautan menu Favorit
  'a[href*="fav=1"]', // tautan Favorit di footer
].join(",");

// Arahkan ke halaman masuk, lalu kembali ke halaman ini setelah login
function keHalamanMasuk() {
  const kembali = location.pathname.split("/").pop() + location.search;
  location.href = "masuk.html?next=" + encodeURIComponent(kembali || "index.html");
}

let sudahLogin = null; // null = belum diketahui, true/false = hasil pengecekan sesi
Auth.session().then((s) => {
  sudahLogin = !!s;
  // Membuka cari.html?fav=1 langsung tanpa login juga diarahkan ke masuk
  if (!s && new URLSearchParams(location.search).get("fav")) keHalamanMasuk();
});

// Fase capture: berjalan sebelum handler lain, jadi bisa membatalkan aksi
document.addEventListener(
  "click",
  async (e) => {
    const target = e.target.closest(SELECTOR_TERLINDUNGI);
    if (!target || sudahLogin === true) return; // bukan aksi terlindungi / sudah login: lanjut

    e.preventDefault();
    e.stopPropagation();

    if (sudahLogin === null) {
      // Sesi belum selesai dicek: tunggu dulu
      sudahLogin = !!(await Auth.session());
      if (sudahLogin) {
        target.click(); // sudah login, ulangi klik agar aksinya berjalan
        return;
      }
    }
    keHalamanMasuk();
  },
  true,
);