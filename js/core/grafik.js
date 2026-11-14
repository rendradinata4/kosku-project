// Pembuat grafik sederhana (batang, area, donat, baris) tanpa library.
// Setiap fungsi MENGEMBALIKAN teks HTML; pemanggil yang memasukkannya ke halaman (innerHTML).
// Membutuhkan fungsi esc() dari util.js (untuk mengamankan teks dari data).

const Grafik = {

  // Menyingkat angka rupiah untuk label sumbu: 1.250.000 -> "1,3 jt", 49.000 -> "49 rb"
  singkat(n) {
    if (n >= 1e6) return Number((n / 1e6).toFixed(1)).toLocaleString("id-ID") + " jt";
    if (n >= 1e3) return Number((n / 1e3).toFixed(1)).toLocaleString("id-ID") + " rb";
    return String(Math.round(n));
  },

  // Mencari batas atas sumbu yang "bulat" supaya garis bantu rapi (4 ruas).
  // Contoh: nilai tertinggi 178.000 -> langkah 50.000 -> sumbu 0 sampai 200.000.
  skala(maks) {
    if (!(maks > 0)) return { atas: 4, langkah: 1 }; // semua nol: sumbu 0..4 saja
    const pangkat = 10 ** Math.floor(Math.log10(maks)); // 178000 -> 100000
    // Daftar langkah yang enak dibaca, dari kecil ke besar
    const langkah = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map((m) => m * pangkat).find((s) => s * 4 >= maks);
    return { atas: langkah * 4, langkah };
  },

  // ---------- Grafik batang (pil) ----------
  // data: [{ label, judul, nilai }]; format: fungsi pengubah angka jadi teks
  batang(data, format) {
    const maks = Math.max(...data.map((d) => d.nilai), 0);
    const { atas, langkah } = Grafik.skala(maks);
    const puncak = maks > 0 ? data.findIndex((d) => d.nilai === maks) : -1; // batang tertinggi disorot

    // Label sumbu Y: 5 buah (0 sampai atas), posisinya dihitung dari bawah dengan persen
    const sumbu = [0, 1, 2, 3, 4]
      .map((i) => `<span style="bottom:${i * 25}%">${i === 0 ? "0" : format(i * langkah)}</span>`)
      .join("");
    // Garis putus-putus di setiap label
    const garis = [0, 1, 2, 3, 4].map((i) => `<i style="bottom:${i * 25}%"></i>`).join("");

    const kolom = data
      .map((d, i) => {
        const tinggi = d.nilai > 0 ? Math.max(6, (d.nilai / atas) * 100) : 0; // persen dari tinggi area
        const gelembung = i === puncak ? `<span class="gf-gelembung">${esc(format(d.nilai))}</span>` : "";
        return `<div class="gf-kolom" title="${esc(d.judul || d.label)}: ${esc(format(d.nilai))}">
          <div class="gf-batang${i === puncak ? " puncak" : ""}${d.nilai ? "" : " kosong"}" style="height:${tinggi}%">${gelembung}</div></div>`;
      })
      .join("");
    const nama = data.map((d) => `<span>${esc(d.label)}</span>`).join("");

    return `<div class="gf-batang-wrap" role="img" aria-label="${esc(data.map((d) => `${d.judul || d.label} ${format(d.nilai)}`).join(", "))}">
      <div class="gf-y">${sumbu}</div>
      <div class="gf-area"><div class="gf-garis">${garis}</div><div class="gf-kolom-wrap">${kolom}</div></div>
      <div class="gf-x">${nama}</div></div>`;
  },

  // ---------- Grafik area (garis dengan isi) ----------
  // data: [{ label, judul, nilai }]
  area(data) {
    const nilai = data.map((d) => d.nilai);
    const min = Math.min(...nilai), maks = Math.max(...nilai);
    const jarak = Math.max(1, (maks - min) * 0.25); // ruang kosong atas & bawah agar garis tidak menempel tepi
    const bawah = Math.max(0, min - jarak), atas = maks + jarak;
    const L = 300, T = 100; // ukuran kanvas SVG (satuan bebas; nanti diskalakan CSS)
    const x = (i) => (data.length === 1 ? L / 2 : (i / (data.length - 1)) * L);
    const y = (v) => T - ((v - bawah) / (atas - bawah)) * T;

    // Garis melengkung: antar titik dibuat kurva dengan titik kendali di tengah
    let garis = `M ${x(0)} ${y(nilai[0])}`;
    for (let i = 1; i < data.length; i++) {
      const tengah = (x(i - 1) + x(i)) / 2;
      garis += ` C ${tengah} ${y(nilai[i - 1])}, ${tengah} ${y(nilai[i])}, ${x(i)} ${y(nilai[i])}`;
    }
    const isi = `${garis} L ${x(data.length - 1)} ${T} L ${x(0)} ${T} Z`; // ditutup ke dasar untuk warna isi
    const akhir = data.length - 1;

    return `<div class="gf-area-wrap" role="img" aria-label="${esc(data.map((d) => `${d.judul || d.label} ${d.nilai}`).join(", "))}">
      <div class="gf-svgbox">
        <svg viewBox="0 0 ${L} ${T}" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="gfIsi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#00a86b" stop-opacity=".35"/><stop offset="1" stop-color="#00a86b" stop-opacity="0"/></linearGradient></defs>
          <path d="${isi}" fill="url(#gfIsi)"/>
          <path d="${garis}" fill="none" stroke="#00864f" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        </svg>
        <span class="gf-titik" style="left:${(x(akhir) / L) * 100}%;top:${(y(nilai[akhir]) / T) * 100}%"></span>
      </div>
      <div class="gf-x">${data.map((d) => `<span>${esc(d.label)}</span>`).join("")}</div></div>`;
  },

  // ---------- Diagram donat + legenda ----------
  // bagian: [{ label, nilai, warna }]; tengah: { angka, teks } tulisan di lubang donat
  donat(bagian, tengah) {
    const total = bagian.reduce((s, b) => s + b.nilai, 0);
    let mulai = 0; // posisi awal tiap potongan (dalam persen dari lingkaran)
    // Lingkaran r=15.9155 punya keliling tepat 100, sehingga panjang garis = persen
    const potong = total
      ? bagian
          .filter((b) => b.nilai > 0)
          .map((b) => {
            const persen = (b.nilai / total) * 100;
            const celah = bagian.filter((x) => x.nilai > 0).length > 1 ? 1 : 0; // jarak kecil antar potongan
            const el = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${b.warna}" stroke-width="5"
              stroke-dasharray="${Math.max(persen - celah, 0.1)} ${100 - persen + celah}" stroke-dashoffset="${25 - mulai}"><title>${esc(b.label)}: ${b.nilai}</title></circle>`;
            mulai += persen;
            return el;
          })
          .join("")
      : "";
    const legenda = bagian
      .map((b) => `<li><i style="background:${b.warna}"></i><span>${esc(b.label)}</span><b>${b.nilai}</b>
        <em>${total ? Math.round((b.nilai / total) * 100) : 0}%</em></li>`)
      .join("");
    return `<div class="gf-donat">
      <div class="gf-donat-gbr"><svg viewBox="0 0 42 42" role="img" aria-label="${esc(bagian.map((b) => `${b.label} ${b.nilai}`).join(", "))}">
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#eef2f7" stroke-width="5"/>${potong}</svg>
        <div class="gf-donat-isi"><b>${esc(tengah.angka)}</b><span>${esc(tengah.teks)}</span></div></div>
      <ul class="gf-legenda">${legenda}</ul></div>`;
  },

  // ---------- Batang mendatar (peringkat) ----------
  // data: [{ label, nilai, teks }]; teks = tulisan di ujung kanan
  baris(data, kosong) {
    if (!data.length) return `<p class="dash-empty">${esc(kosong || "Belum ada data.")}</p>`;
    const maks = Math.max(...data.map((d) => d.nilai), 1);
    return `<ul class="gf-baris">${data
      .map((d) => `<li><div class="gf-baris-atas"><span>${esc(d.label)}</span><b>${esc(d.teks)}</b></div>
        <div class="gf-trek"><div class="gf-isi" style="width:${Math.max(3, (d.nilai / maks) * 100)}%"></div></div></li>`)
      .join("")}</ul>`;
  },
};