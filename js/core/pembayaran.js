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

  // Transaksi yang boleh dilihat pemanggil: admin melihat semuanya, pemilik hanya miliknya (diatur RLS)
  async semua() {
    return cek(
      await db
        .from("pembayaran")
        .select("id, kode, kos_id, nama_kos, nama_pemilik, bulan, nominal, status, dibuat_pada, kedaluwarsa_pada, dibayar_pada, aktif_sampai")
        .order("dibuat_pada", { ascending: false }),
    );
  },

  // Alamat halaman bayar yang dimasukkan ke dalam QR
  urlBayar(kode) {
    return new URL("bayar.html?kode=" + encodeURIComponent(kode), location.href).href;
  },

  // Keadaan masa tayang dari tanggal berakhir (aktif_sampai).
  // Hasil: { status: "habis" | "segera" | "aman" | "belum", hari, label }
  //  - habis  : tanggal berakhir sudah lewat
  //  - segera : sisa 7 hari atau kurang (saatnya memperpanjang)
  //  - aman   : sisa lebih dari 7 hari
  masa(iso) {
    if (!iso) return { status: "belum", hari: 0, label: "Belum ada masa tayang" };
    const sisa = new Date(iso).getTime() - Date.now(); // selisih milidetik
    if (sisa <= 0) {
      const lalu = Math.floor(-sisa / 864e5); // sudah berapa hari lewat
      return { status: "habis", hari: 0, label: lalu < 1 ? "Habis hari ini" : `Habis ${lalu} hari lalu` };
    }
    const hari = Math.ceil(sisa / 864e5); // dibulatkan ke atas: sisa 2,1 hari dihitung 3 hari
    return { status: hari <= 7 ? "segera" : "aman", hari, label: hari === 1 ? "1 hari lagi" : `${hari} hari lagi` };
  },

  // KONSOL DEMO (admin): atur sisa masa tayang kos. hari = 0 berarti habis sekarang.
  async demoAtur(kosId, hari) {
    return cek(await db.rpc("demo_atur_masa_tayang", { p_kos_id: kosId, p_hari: hari }));
  },

  tanggal(iso) {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  },
};