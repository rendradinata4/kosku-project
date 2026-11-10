// Lapisan data: semua pembacaan dari Supabase lewat file ini.
// Hasilnya diterjemahkan ke bentuk yang sama dengan data/kos.json,
// sehingga kode halaman (cari.js, detail.js, dst.) hampir tidak perlu diubah.

const KOS_SELECT = `
  id, nama, deskripsi, alamat, latitude, longitude, tipe, rating,
  jarak_terdekat, no_whatsapp,
  kamar ( harga, status ),
  fasilitas ( nama, kategori ),
  aturan ( isi, urutan ),
  kos_gambar ( path, urutan )
`;

// URL penuh dipakai apa adanya; path lain dianggap file di Supabase Storage (dibuat di tahap upload foto)
const gambarUrl = (path) =>
  /^https?:\/\//.test(path)
    ? path
    : db.storage.from("kos-foto").getPublicUrl(path).data.publicUrl;

// Semua teks dari database di-escape di sini (fungsi esc() ada di auth.js, dipakai saat dipanggil),
// karena halaman menempelkannya ke innerHTML dan pemilik kos bisa mengetik apa saja.
function mapKos(r) {
  const urut = (arr) => [...(arr || [])].sort((a, b) => a.urutan - b.urutan);
  const kamar = r.kamar || [];
  const fas = r.fasilitas || [];
  const galeri = urut(r.kos_gambar).map((g) => esc(gambarUrl(g.path)));

  return {
    id: String(r.id),
    nama: esc(r.nama),
    deskripsi: esc(r.deskripsi),
    tipe: r.tipe,
    hargaBulanan: kamar.length ? Math.min(...kamar.map((k) => k.harga)) : 0, // kamar termurah
    alamat: esc(r.alamat),
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    rating: Number(r.rating),
    sisaKamar: kamar.filter((k) => k.status === "tersedia").length, // dihitung dari kamar
    gambarUtama: galeri[0] || "",
    galeri,
    fasilitas: fas.filter((f) => f.kategori === "kamar").map((f) => esc(f.nama)),
    bersama: fas.filter((f) => f.kategori === "bersama").map((f) => esc(f.nama)),
    aturan: urut(r.aturan).map((a) => esc(a.isi)),
    jarakTerdekat: esc(r.jarak_terdekat),
    noWhatsapp: String(r.no_whatsapp || "").replace(/\D/g, ""), // hanya angka
  };
}

async function getAllKos() {
  const { data, error } = await db
    .from("kos")
    .select(KOS_SELECT)
    .eq("status", "aktif")
    .order("id");
  if (error) throw error;
  return data.map(mapKos);
}