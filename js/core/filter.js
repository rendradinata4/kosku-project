// Logika filter & pencarian data kos.
// Semua data kos aktif sudah dimuat sekali oleh getAllKos(), jadi penyaringan dilakukan
// langsung di browser: hasilnya instan setiap filter diubah, tanpa query ke database.

// Daftar kampus di Surabaya + koordinat perkiraan (titik tengah kampus).
// Jarak kos ke kampus dihitung dari koordinat kos (lat/lng di database) dengan rumus haversine (km() di util.js).
// Mau menambah kampus? Cukup tambah satu baris di sini.
const KAMPUS = [
  { id: "unair-c", nama: "Unair Kampus C", lat: -7.2690, lng: 112.7842 },
  { id: "unair-b", nama: "Unair Kampus B (Dharmawangsa)", lat: -7.2655, lng: 112.7578 },
  { id: "its", nama: "ITS Sukolilo", lat: -7.2819, lng: 112.7948 },
  { id: "unesa-ketintang", nama: "Unesa Ketintang", lat: -7.3138, lng: 112.7254 },
  { id: "unesa-lidah", nama: "Unesa Lidah Wetan", lat: -7.3050, lng: 112.6720 },
  { id: "upn", nama: "UPN Veteran Jatim", lat: -7.3331, lng: 112.7881 },
  { id: "uinsa", nama: "UIN Sunan Ampel", lat: -7.3367, lng: 112.7833 },
  { id: "petra", nama: "Universitas Kristen Petra", lat: -7.3367, lng: 112.7387 },
  { id: "ubaya", nama: "Ubaya Tenggilis", lat: -7.3190, lng: 112.7680 },
  { id: "untag", nama: "Untag 1945 Surabaya", lat: -7.3010, lng: 112.7689 },
  { id: "ciputra", nama: "Universitas Ciputra", lat: -7.2879, lng: 112.6302 },
];

const Filter = {
  // Keadaan awal (tanpa filter). Dipakai juga untuk reset.
  awal() {
    return {
      q: "", tipe: "", min: 0, max: Infinity,
      fas: [], bersama: [], // fasilitas kamar & fasilitas bersama yang harus ada semua
      kampus: "", radius: 2, // id kampus + batas jarak (km)
      rating: 0, tersedia: false, favOnly: false,
    };
  },
  state: null,

  kampusAktif() {
    return KAMPUS.find((c) => c.id === this.state.kampus) || null;
  },

  apply(data) {
    const s = this.state, q = s.q.toLowerCase(), kampus = this.kampusAktif();
    return data.filter((k) =>
      (!q || [k.nama, k.alamat, k.jarakTerdekat].some((t) => t.toLowerCase().includes(q))) &&
      (!s.tipe || k.tipe === s.tipe) &&
      k.hargaBulanan >= s.min && k.hargaBulanan <= s.max &&
      s.fas.every((f) => k.fasilitas.includes(f)) &&
      s.bersama.every((f) => k.bersama.includes(f)) &&
      k.rating >= s.rating &&
      (!s.tersedia || k.sisaKamar > 0) &&
      (!kampus || km(k, kampus) <= s.radius) &&
      (!s.favOnly || Fav.has(k.id))
    );
  },

  // Daftar filter yang sedang aktif (untuk label yang bisa dihapus satu per satu)
  tags() {
    const s = this.state, t = [], kampus = this.kampusAktif();
    if (s.tipe) t.push({ label: "Kos " + s.tipe, hapus: () => (s.tipe = "") });
    if (s.min > 0 || s.max < Infinity) {
      const label = s.max < Infinity
        ? (s.min > 0 ? `${rp(s.min)} – ${rp(s.max)}` : `≤ ${rp(s.max)}`)
        : `≥ ${rp(s.min)}`;
      t.push({ label, hapus: () => { s.min = 0; s.max = Infinity; } });
    }
    if (kampus) t.push({ label: `≤ ${s.radius} km dari ${kampus.nama}`, hapus: () => (s.kampus = "") });
    s.fas.forEach((f) => t.push({ label: f, hapus: () => (s.fas = s.fas.filter((x) => x !== f)) }));
    s.bersama.forEach((f) => t.push({ label: f, hapus: () => (s.bersama = s.bersama.filter((x) => x !== f)) }));
    if (s.rating > 0) t.push({ label: `Rating ≥ ${s.rating}`, hapus: () => (s.rating = 0) });
    if (s.tersedia) t.push({ label: "Kamar tersedia", hapus: () => (s.tersedia = false) });
    return t;
  },
};
Filter.state = Filter.awal();