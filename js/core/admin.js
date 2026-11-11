// Fungsi data khusus admin. Membutuhkan owner.js (cek, Owner.hapus, Owner.urlFoto).
// Hak akses dijaga RLS dan fungsi database (security definer) yang memeriksa bahwa pemanggilnya admin.

const KOS_ADMIN_SELECT = `
  id, nama, deskripsi, alamat, latitude, longitude, tipe, rating, jarak_terdekat, no_whatsapp,
  status, alasan_penolakan, created_at,
  pemilik:profiles!user_id ( nama, no_telepon ),
  kamar ( nomor_kamar, harga, status ),
  kos_gambar ( path, urutan ),
  fasilitas ( nama, kategori ),
  aturan ( isi, urutan )
`;

const Admin = {

  // Daftar kelengkapan yang harus terpenuhi sebelum kos disetujui (database memeriksa hal yang sama)
  kelengkapan(k) {
    return [
      { ok: k.kos_gambar.length > 0, teks: `Foto: ${k.kos_gambar.length}` },
      { ok: k.kamar.length > 0, teks: `Kamar: ${k.kamar.length}` },
      { ok: /^62\d{8,12}$/.test(k.no_whatsapp || ""), teks: "Nomor WhatsApp valid" },
    ];
  },
  bisaDisetujui(k) {
    return k.status === "menunggu" && Admin.kelengkapan(k).every((x) => x.ok);
  },

  validasiFasilitas(nama, kategori) {
    const e = [];
    const n = String(nama || "").trim();
    if (n.length < 2 || n.length > 40) e.push("Nama fasilitas 2 sampai 40 karakter.");
    if (!["kamar", "bersama"].includes(kategori)) e.push("Pilih kategori fasilitas.");
    return e;
  },

  // ---------- Kos ----------
  async semuaKos() {
    return cek(await db.from("kos").select(KOS_ADMIN_SELECT).order("created_at", { ascending: true }));
  },
  async setujui(id) {
    cek(await db.rpc("setujui_kos", { p_kos_id: id }));
  },
  async tolak(id, alasan) {
    cek(await db.rpc("tolak_kos", { p_kos_id: id, p_alasan: alasan }));
  },
  async aturRating(id, rating) {
    cek(await db.rpc("atur_rating", { p_kos_id: id, p_rating: rating }));
  },
  async hapusKos(id) {
    return Owner.hapus(id); // juga membersihkan file foto di Storage
  },

  // ---------- Fasilitas ----------
  async daftarFasilitas() {
    return cek(await db.from("fasilitas").select("id, nama, kategori, kos_fasilitas ( count )").order("kategori").order("nama"));
  },
  async tambahFasilitas(nama, kategori) {
    cek(await db.from("fasilitas").insert({ nama: nama.trim(), kategori }));
  },
  async ubahFasilitas(id, nama, kategori) {
    const baris = cek(await db.from("fasilitas").update({ nama: nama.trim(), kategori }).eq("id", id).select("id"));
    if (!baris || !baris.length) throw new Error("Fasilitas tidak ditemukan.");
  },
  async hapusFasilitas(id) {
    const baris = cek(await db.from("fasilitas").delete().eq("id", id).select("id"));
    if (!baris || !baris.length) throw new Error("Fasilitas tidak ditemukan.");
  },

};