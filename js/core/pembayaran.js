// Fungsi data pembayaran biaya publikasi kos (simulasi QR).
// Membutuhkan owner.js (fungsi cek). Harga yang sebenarnya dihitung dan dijaga oleh database;
// daftar PAKET di sini hanya untuk tampilan.

const PAKET = [
  { bulan: 1, harga: 49000, label: "1 bulan", hemat: "" },
  { bulan: 3, harga: 129000, label: "3 bulan", hemat: "Hemat 12%" },
  { bulan: 12, harga: 449000, label: "12 bulan", hemat: "Hemat 24%" },
];

const Pembayaran = {
  PAKET,

  // Buat transaksi baru; mengembalikan { kode, nominal, kedaluwarsa_pada }
  async buat(kosId, bulan) {
    return cek(await db.rpc("buat_pembayaran", { p_kos_id: kosId, p_bulan: bulan }));
  },

  // Status satu transaksi milik pemilik (dipakai untuk memantau apakah QR sudah dibayar)
  async status(kode) {
    return cek(await db.from("pembayaran").select("status, aktif_sampai").eq("kode", kode).maybeSingle());
  },

  // Pembayaran lunas milik pemilik (untuk menampilkan masa tayang)
  async milikSaya(uid) {
    return cek(
      await db.from("pembayaran").select("kos_id, aktif_sampai").eq("user_id", uid).eq("status", "lunas"),
    );
  },

  // Semua transaksi (khusus admin; RLS menolak selain admin)
  async semua() {
    return cek(
      await db
        .from("pembayaran")
        .select("id, kode, nama_kos, nama_pemilik, bulan, nominal, status, dibuat_pada, kedaluwarsa_pada, dibayar_pada, aktif_sampai")
        .order("dibuat_pada", { ascending: false }),
    );
  },

  // Alamat halaman bayar yang dimasukkan ke dalam QR
  urlBayar(kode) {
    return new URL("bayar.html?kode=" + encodeURIComponent(kode), location.href).href;
  },

  tanggal(iso) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  },
};