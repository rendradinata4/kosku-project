const $ = (s) => document.querySelector(s);

const STATUS = {
  draft: { label: "Draft", kelas: "st-draft" },
  menunggu: { label: "Menunggu persetujuan", kelas: "st-menunggu" },
  menunggu_pembayaran: { label: "Menunggu pembayaran", kelas: "st-bayar" },
  aktif: { label: "Tayang", kelas: "st-aktif" },
  ditolak: { label: "Ditolak", kelas: "st-ditolak" },
};
const urut = (a) => [...a].sort((x, y) => x.urutan - y.urutan);

let profil;
let tab = "home";
let kos = [], fasilitas = [], transaksi = [];
let filterStatus = "", cariTeks = "";
let tolakId = null;

function notif(teks, jenis = "ok") {
  const el = $("#notif");
  el.textContent = teks;
  el.className = "dash-notif " + jenis;
  el.hidden = !teks;
}
const galat = (err) =>
  err && err.code === "23505" ? "Gagal: nama fasilitas itu sudah ada." : "Gagal: " + ((err && err.message) || "coba lagi.");

// ---------- Kos ----------
function rentangHarga(k) {
  const h = k.kamar.map((x) => x.harga);
  if (!h.length) return "belum ada kamar";
  const a = Math.min(...h), b = Math.max(...h);
  return a === b ? rp(a) : `${rp(a)} – ${rp(b)}`;
}

function detailKos(k, buka) {
  const foto = urut(k.kos_gambar);
  const kamar = [...k.kamar].sort((a, b) => String(a.nomor_kamar).localeCompare(String(b.nomor_kamar), undefined, { numeric: true }));
  const wa = String(k.no_whatsapp || "").replace(/\D/g, "");
  const p = k.pemilik;
  return `<details ${buka ? "open" : ""}><summary>Detail untuk ditinjau</summary><div class="adm-detail">
    <div class="adm-foto">${
      foto.length
        ? foto.map((f) => { const u = esc(Owner.urlFoto(f.path)); return `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="" loading="lazy"></a>`; }).join("")
        : '<p class="dash-hint">Belum ada foto.</p>'
    }</div>
    <dl class="adm-dl">
      <dt>Pemilik</dt><dd>${esc(p ? p.nama : "-")}${p && p.no_telepon ? " · " + esc(p.no_telepon) : ""}</dd>
      <dt>WhatsApp kos</dt><dd>${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">${esc(wa)}</a>` : "-"}</dd>
      <dt>Lokasi</dt><dd>${esc(k.alamat)} · <a href="https://www.google.com/maps/search/?api=1&amp;query=${Number(k.latitude)},${Number(k.longitude)}" target="_blank" rel="noopener">Buka di peta</a></dd>
      <dt>Jarak</dt><dd>${esc(k.jarak_terdekat || "-")}</dd>
      <dt>Deskripsi</dt><dd>${esc(k.deskripsi || "-")}</dd>
      <dt>Fasilitas</dt><dd>${k.fasilitas.length ? k.fasilitas.map((f) => `<span class="adm-chip">${esc(f.nama)}</span>`).join("") : "-"}</dd>
      <dt>Aturan</dt><dd>${k.aturan.length ? "<ul>" + urut(k.aturan).map((a) => `<li>${esc(a.isi)}</li>`).join("") + "</ul>" : "-"}</dd>
      <dt>Kamar</dt><dd>${kamar.length ? kamar.map((m) => `<span class="adm-chip">${esc(m.nomor_kamar)} · ${rp(m.harga)} · ${esc(m.status)}</span>`).join("") : "-"}</dd>
    </dl></div></details>`;
}

function kartu(k, buka) {
  const st = STATUS[k.status];
  const cek = Admin.kelengkapan(k).map((x) => `<span class="adm-cek ${x.ok ? "ok" : "no"}">${x.ok ? "✓" : "✕"} ${esc(x.teks)}</span>`).join("");
  const aksi = [];
  if (k.status === "menunggu") {
    const bisa = Admin.bisaDisetujui(k);
    aksi.push(`<button type="button" class="dash-btn" data-aksi="setujui" data-id="${k.id}" ${bisa ? "" : 'disabled title="Lengkapi dulu: foto, kamar, dan nomor WhatsApp"'}>Setujui</button>`);
    aksi.push(`<button type="button" class="dash-btn danger" data-aksi="tolak" data-id="${k.id}">Tolak…</button>`);
  } else if (k.status === "aktif") {
    aksi.push(`<a class="dash-btn ghost" href="detail.html?id=${k.id}">Lihat di situs</a>`);
    aksi.push(`<button type="button" class="dash-btn danger" data-aksi="tolak" data-id="${k.id}">Turunkan…</button>`);
  }
  aksi.push(`<button type="button" class="dash-btn danger" data-aksi="hapus" data-id="${k.id}">Hapus</button>`);
  return `<article class="dash-card adm-card" data-kos="${k.id}">
    <div class="dash-info">
      <div class="dash-row"><h2>${esc(k.nama)}</h2><span class="dash-badge ${st.kelas}">${st.label}</span></div>
      <p class="dash-meta">${esc(k.tipe)} · ${esc(k.alamat)}</p>
      <p class="dash-meta">Pemilik: ${esc(k.pemilik ? k.pemilik.nama : "-")} · Kamar mulai ${rentangHarga(k)}</p>
      <div class="adm-cekrow">${cek}</div>
      ${k.status === "ditolak" ? `<p class="dash-alasan"><b>Alasan penolakan:</b> ${esc(k.alasan_penolakan || "-")}</p>` : ""}
    </div>
    ${detailKos(k, buka)}
    <div class="dash-actions">
      <span class="adm-rating"><label>Rating <input type="number" min="0" max="5" step="0.1" value="${Number(k.rating)}" data-rating-input="${k.id}"></label>
        <button type="button" class="dash-btn ghost" data-aksi="rating" data-id="${k.id}">Simpan</button></span>
      ${aksi.join("")}
    </div>
  </article>`;
}

function panelAntrean() {
  const antre = kos.filter((k) => k.status === "menunggu");
  $("#panel").innerHTML = antre.length
    ? `<p class="dash-sub" style="margin-bottom:12px">Diurutkan dari pengajuan terlama.</p><div class="dash-list">${antre.map((k) => kartu(k, true)).join("")}</div>`
    : '<p class="dash-empty">Tidak ada kos yang menunggu persetujuan.</p>';
}

function panelKos() {
  const hitung = (s) => kos.filter((k) => k.status === s).length;
  $("#panel").innerHTML = `<div class="adm-toolbar">
      <select id="filterStatus" aria-label="Filter status">
        <option value="">Semua status (${kos.length})</option>
        ${Object.entries(STATUS).map(([v, s]) => `<option value="${v}" ${filterStatus === v ? "selected" : ""}>${s.label} (${hitung(v)})</option>`).join("")}
      </select>
      <input id="cariKos" type="search" placeholder="Cari nama kos atau nama pemilik" value="${esc(cariTeks)}" aria-label="Cari kos">
    </div><div class="dash-list" id="daftarKos"></div>`;
  isiDaftarKos();
}

function isiDaftarKos() {
  const q = cariTeks.trim().toLowerCase();
  const hasil = kos.filter((k) => (!filterStatus || k.status === filterStatus) &&
    (!q || k.nama.toLowerCase().includes(q) || (k.pemilik && k.pemilik.nama.toLowerCase().includes(q))));
  $("#daftarKos").innerHTML = hasil.length ? hasil.map((k) => kartu(k, false)).join("") : '<p class="dash-empty">Tidak ada kos yang cocok.</p>';
}

// ---------- Fasilitas ----------
function panelFasilitas() {
  const opsi = (sel) => ["kamar", "bersama"].map((k) => `<option value="${k}" ${sel === k ? "selected" : ""}>${k === "kamar" ? "Fasilitas kamar" : "Fasilitas bersama"}</option>`).join("");
  $("#panel").innerHTML = `<div class="adm-form-tambah">
      <input id="fasNama" maxlength="40" placeholder="Nama fasilitas baru" aria-label="Nama fasilitas baru" class="adm-input">
      <select id="fasKategori" aria-label="Kategori">${opsi("kamar")}</select>
      <button type="button" class="dash-btn" data-aksi="fas-tambah">+ Tambah</button>
    </div>
    <div class="adm-scroll"><table class="adm-tabel"><thead><tr><th>Nama</th><th>Kategori</th><th>Dipakai</th><th></th></tr></thead><tbody>
    ${fasilitas.map((f) => `<tr data-fas="${f.id}">
      <td><input data-f="nama" value="${esc(f.nama)}" maxlength="40" aria-label="Nama fasilitas"></td>
      <td><select data-f="kategori" aria-label="Kategori fasilitas">${opsi(f.kategori)}</select></td>
      <td>${f.kos_fasilitas && f.kos_fasilitas[0] ? f.kos_fasilitas[0].count : 0} kos</td>
      <td class="adm-aksi"><button type="button" class="dash-btn ghost" data-aksi="fas-simpan" data-id="${f.id}">Simpan</button>
        <button type="button" class="dash-btn danger" data-aksi="fas-hapus" data-id="${f.id}">Hapus</button></td></tr>`).join("")}
    </tbody></table></div>
    <p class="f-hint" style="margin-top:10px">Ikon di halaman publik hanya tersedia untuk fasilitas bawaan (AC, Wi-Fi, Kamar Mandi Dalam, Kasur, Lemari). Fasilitas baru tetap tampil di halaman detail.</p>`;
}

// ---------- Keuangan ----------
const ringkasUang = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " jt" : Math.round(n / 1e3) + " rb");

// Transaksi menunggu yang waktunya sudah lewat dianggap kedaluwarsa
function statusTransaksi(t) {
  return t.status === "pending" && new Date(t.kedaluwarsa_pada) < new Date() ? "kedaluwarsa" : t.status;
}

// ---------- WhatsApp ke pemilik ----------
// Nomor tujuan: utamakan nomor WhatsApp kos (format 62...), cadangannya nomor telepon pemilik (08... diubah jadi 62...)
function nomorWa(k) {
  const a = String(k.no_whatsapp || "").replace(/\D/g, "");
  if (/^62\d{8,12}$/.test(a)) return a;
  const t = String((k.pemilik && k.pemilik.no_telepon) || "").replace(/\D/g, "");
  if (/^0\d{8,12}$/.test(t)) return "62" + t.slice(1);
  if (/^62\d{8,12}$/.test(t)) return t;
  return ""; // tidak ada nomor yang valid
}

// Tombol WhatsApp: membuka chat dengan pesan yang sudah terisi (admin tinggal menekan kirim)
function tombolWa(k, pesan) {
  const nomor = k ? nomorWa(k) : "";
  if (!nomor) return '<span class="wa-tidak" title="Pemilik belum mengisi nomor yang valid">Tanpa nomor</span>';
  return `<a class="dash-btn wa" href="https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}" target="_blank" rel="noopener"><span class="material-symbols-outlined">chat</span>WhatsApp</a>`;
}

// Tanggal berakhir terjauh dari semua pembayaran lunas sebuah kos (null jika belum pernah bayar)
function tayangSampaiKos(id) {
  const w = transaksi.filter((t) => t.status === "lunas" && String(t.kos_id) === String(id)).map((t) => new Date(t.aktif_sampai).getTime());
  return w.length ? new Date(Math.max(...w)).toISOString() : null;
}

// Pesan WhatsApp sesuai keadaan. jenis: bayar | habis | segera | lunas | qr | kedaluwarsa
function pesanWa(jenis, k, sampai) {
  const nama = (k.pemilik && k.pemilik.nama) || "Bapak/Ibu";
  const buka = `Halo ${nama}, kami admin RuangNyaman.`;
  const dashboard = "Silakan buka dashboard pemilik di RuangNyaman";
  const tgl = sampai ? Pembayaran.tanggal(sampai) : "";
  return {
    bayar: `${buka} Kos "${k.nama}" sudah disetujui dan siap tayang, tinggal menyelesaikan pembayaran biaya publikasi. ${dashboard}, pilih "Bayar & tayangkan", lalu scan QR-nya. Terima kasih.`,
    qr: `${buka} Kami melihat QR pembayaran untuk kos "${k.nama}" belum dipindai. ${dashboard} dan selesaikan pembayarannya agar kos tayang. Jika QR kedaluwarsa, buat QR baru. Terima kasih.`,
    habis: `${buka} Masa tayang kos "${k.nama}" telah berakhir pada ${tgl}, sehingga kos tidak lagi tampil di pencarian. ${dashboard} dan tekan "Perpanjang" agar kos tayang kembali. Terima kasih.`,
    segera: `${buka} Masa tayang kos "${k.nama}" akan berakhir pada ${tgl}. Agar tidak hilang dari pencarian, silakan perpanjang lewat dashboard pemilik (tombol "Perpanjang"). Terima kasih.`,
    lunas: `${buka} Terima kasih, pembayaran biaya publikasi kos "${k.nama}" sudah kami terima${tgl ? ` dan kos tayang sampai ${tgl}` : ""}.`,
    kedaluwarsa: `${buka} QR pembayaran untuk kos "${k.nama}" sudah kedaluwarsa. ${dashboard} dan buat QR baru agar kos bisa tayang. Terima kasih.`,
  }[jenis];
}

// Daftar kos yang "belum lunas": belum membayar, masa tayang habis, atau segera habis
function daftarBelumLunas() {
  const hasil = [];
  kos.forEach((k) => {
    if (k.status === "menunggu_pembayaran") {
      const qr = transaksi.some((t) => String(t.kos_id) === String(k.id) && statusTransaksi(t) === "pending");
      hasil.push({ k, jenis: "bayar", urut: 2, hari: 0, label: qr ? "QR belum dipindai" : "Belum membayar", kelas: "st-bayar", pesan: pesanWa(qr ? "qr" : "bayar", k) });
    } else if (k.status === "aktif") {
      const sampai = tayangSampaiKos(k.id);
      const m = Pembayaran.masa(sampai);
      if (m.status === "habis") hasil.push({ k, jenis: "habis", urut: 1, hari: 0, sampai, label: "Masa tayang habis", detail: m.label, kelas: "st-habis", pesan: pesanWa("habis", k, sampai) });
      else if (m.status === "segera") hasil.push({ k, jenis: "segera", urut: 3, hari: m.hari, sampai, label: "Segera habis", detail: m.label, kelas: "st-menunggu", pesan: pesanWa("segera", k, sampai) });
    }
  });
  return hasil.sort((a, b) => a.urut - b.urut || a.hari - b.hari);
}

let keuLihat = "semua"; // "semua" = riwayat & grafik, "belum" = daftar belum lunas
let keuJenis = "";      // saringan pada daftar belum lunas: "" | bayar | habis | segera

function htmlBelumLunas() {
  const semua = daftarBelumLunas();
  const jml = (j) => semua.filter((x) => x.jenis === j).length;
  const daftar = semua.filter((x) => !keuJenis || x.jenis === keuJenis);
  const chip = (j, teks, n) => `<button type="button" class="${keuJenis === j ? "on" : ""}" data-aksi="keu-jenis" data-id="${j}">${teks} (${n})</button>`;
  const baris = daftar.map((x) => `<tr><td><b>${esc(x.k.nama)}</b></td><td>${esc(x.k.pemilik ? x.k.pemilik.nama : "-")}</td>
      <td>${nomorWa(x.k) ? esc("+" + nomorWa(x.k)) : "-"}</td>
      <td><span class="dash-badge ${x.kelas}">${x.label}</span>${x.detail ? `<small class="keu-detail">${esc(x.detail)}</small>` : ""}</td>
      <td>${tombolWa(x.k, x.pesan)}</td></tr>`).join("");
  return `<div class="hm-seg keu-chip" role="group" aria-label="Saring">${chip("", "Semua", semua.length)}${chip("habis", "Masa tayang habis", jml("habis"))}${chip("bayar", "Belum bayar", jml("bayar"))}${chip("segera", "Segera habis", jml("segera"))}</div>
    ${daftar.length
      ? `<div class="adm-scroll" style="margin-top:12px"><table class="adm-tabel"><thead><tr><th>Kos</th><th>Pemilik</th><th>Nomor</th><th>Keadaan</th><th>Hubungi</th></tr></thead><tbody>${baris}</tbody></table></div>
         <p class="f-hint" style="margin-top:10px">Tombol WhatsApp membuka chat dengan pesan yang sudah terisi. Admin tinggal menekan kirim.</p>`
      : '<p class="dash-empty" style="margin-top:12px">Tidak ada kos yang belum lunas pada kategori ini.</p>'}`;
}

function panelKeuangan() {
  const lunas = transaksi.filter((t) => t.status === "lunas");
  const sekarang = new Date();
  const jumlah = (daftar) => daftar.reduce((s, t) => s + t.nominal, 0);
  const sebulan = (t, d) => {
    const x = new Date(t.dibayar_pada);
    return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear();
  };
  const bulanIni = jumlah(lunas.filter((t) => sebulan(t, sekarang)));
  const menunggu = transaksi.filter((t) => statusTransaksi(t) === "pending").length;

  // Pendapatan 6 bulan terakhir untuk grafik batang
  const bulan = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 1);
    bulan.push({ label: d.toLocaleDateString("id-ID", { month: "short" }), total: jumlah(lunas.filter((t) => sebulan(t, d))) });
  }
  const maks = Math.max(...bulan.map((b) => b.total), 1);

  const ubin = (judul, sub, angka, pertama) => `<div class="stat${pertama ? " first" : ""}">
    <div class="stat-top"><div><p class="stat-t">${judul}</p><p class="stat-s">${sub}</p></div></div>
    <p class="stat-n">${angka}</p></div>`;

  const baris = transaksi.map((t) => {
    const st = statusTransaksi(t);
    const kelas = { lunas: "st-aktif", pending: "st-menunggu", kedaluwarsa: "st-draft" }[st] || "st-draft";
    const label = { lunas: "Lunas", pending: "Menunggu", kedaluwarsa: "Kedaluwarsa" }[st] || st;
    const waktu = Pembayaran.tanggal(t.dibayar_pada || t.dibuat_pada);
    const kosnya = kos.find((x) => String(x.id) === String(t.kos_id));
    const wa = kosnya ? tombolWa(kosnya, pesanWa({ lunas: "lunas", pending: "qr", kedaluwarsa: "kedaluwarsa" }[st], kosnya, t.aktif_sampai)) : '<span class="wa-tidak">Kos dihapus</span>';
    return `<tr><td>${waktu}</td><td>${esc(t.nama_kos)}</td><td>${esc(t.nama_pemilik || "-")}</td>
      <td>${t.bulan} bln</td><td><b>${rp(t.nominal)}</b></td><td><span class="dash-badge ${kelas}">${label}</span></td><td>${wa}</td></tr>`;
  }).join("");

  const nBelum = daftarBelumLunas().length;
  const tombolLihat = (v, teks) => `<button type="button" class="${keuLihat === v ? "on" : ""}" data-aksi="keu-lihat" data-id="${v}">${teks}</button>`;
  const isi = keuLihat === "belum"
    ? htmlBelumLunas()
    : `<h3 class="dsh-panel-title" style="font-size:.95rem">Pendapatan 6 bulan terakhir</h3>
    <div class="keu-chart" role="img" aria-label="Grafik pendapatan 6 bulan terakhir">
      ${bulan.map((b) => `<div class="keu-col"><span class="keu-val">${b.total ? ringkasUang(b.total) : ""}</span>
        <div class="keu-bar" style="height:${Math.max(b.total ? 6 : 2, Math.round((b.total / maks) * 100))}%"></div><span class="keu-lbl">${b.label}</span></div>`).join("")}
    </div>
    <h3 class="dsh-panel-title" style="font-size:.95rem;margin-top:22px">Riwayat transaksi</h3>
    ${transaksi.length
      ? `<div class="adm-scroll"><table class="adm-tabel"><thead><tr><th>Tanggal</th><th>Kos</th><th>Pemilik</th><th>Paket</th><th>Nominal</th><th>Status</th><th>Hubungi</th></tr></thead><tbody>${baris}</tbody></table></div>`
      : '<p class="dash-empty">Belum ada transaksi.</p>'}`;

  $("#panel").innerHTML = `<div class="stats" style="margin-bottom:18px">
      ${ubin("Total pendapatan", "Semua pembayaran lunas", rp(jumlah(lunas)), true)}
      ${ubin("Bulan ini", sekarang.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), rp(bulanIni))}
      ${ubin("Transaksi lunas", "Jumlah pembayaran", lunas.length)}
      ${ubin("Menunggu bayar", "QR belum dipindai", menunggu)}
    </div>
    <div class="hm-seg keu-tab" role="group" aria-label="Tampilan keuangan">${tombolLihat("semua", "Riwayat &amp; grafik")}${tombolLihat("belum", `Belum lunas (${nBelum})`)}</div>
    <div style="margin-top:16px">${isi}</div>`;
}

// ---------- Home (rekap statistik) ----------
let rentang = 6;      // jumlah bulan pada grafik pendapatan (6 atau 12)
let pengguna = null;  // daftar { role }, atau null kalau tidak bisa dibaca

// Warna tiap status kos pada diagram (legenda tetap memuat tulisan, bukan hanya warna)
const WARNA_STATUS = { aktif: "#00a86b", menunggu_pembayaran: "#4f8ef7", menunggu: "#f2b01e", ditolak: "#e5484d", draft: "#9aa7b5" };
const HIJAU = ["#006d43", "#00a86b", "#7fd3a9", "#c4ead6"]; // gradasi hijau untuk diagram lain

const inisial = (nama) => String(nama || "?").trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const hitungPer = (daftar, kunci) =>
  daftar.reduce((h, x) => { const k = kunci(x); h[k] = (h[k] || 0) + 1; return h; }, {});
const bulanSama = (iso, d) => { const x = new Date(iso); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); };

// Total pendapatan per bulan untuk n bulan terakhir (bulan ini paling kanan)
function dataPendapatan(n) {
  const lunas = transaksi.filter((t) => t.status === "lunas" && t.dibayar_pada);
  const sekarang = new Date();
  const hasil = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 1);
    hasil.push({
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      judul: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      nilai: lunas.filter((t) => bulanSama(t.dibayar_pada, d)).reduce((s, t) => s + t.nominal, 0),
    });
  }
  return hasil;
}

// Jumlah kos terdaftar (semua status) yang sudah ada pada akhir tiap bulan, 6 bulan terakhir
function dataPertumbuhan() {
  const sekarang = new Date();
  const hasil = [];
  for (let i = 5; i >= 0; i--) {
    const awalBerikut = new Date(sekarang.getFullYear(), sekarang.getMonth() - i + 1, 1);
    const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 1);
    hasil.push({
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      judul: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      nilai: kos.filter((k) => new Date(k.created_at) < awalBerikut).length,
    });
  }
  return hasil;
}

// Lencana perubahan dibanding bulan lalu: +12% / -5% / Baru
function lencana(ini, lalu) {
  if (!lalu) return ini ? '<span class="hm-chip">Baru</span>' : "";
  const p = Math.round(((ini - lalu) / lalu) * 100);
  return `<span class="hm-chip${p < 0 ? " turun" : ""}">${p > 0 ? "+" : ""}${p}%</span>`;
}

const kepala = (judul, sub, tujuan) => `<div class="hm-kepala"><div><h2>${judul}</h2><p>${sub}</p></div>
  ${tujuan ? `<button type="button" class="hm-ikon" data-aksi="ke-tab" data-id="${tujuan}" aria-label="Buka ${tujuan}"><span class="material-symbols-outlined">arrow_outward</span></button>` : ""}</div>`;

// Isi kartu grafik pendapatan (dipisah agar tombol 6/12 bulan hanya menggambar ulang bagian ini)
function isiPendapatan() {
  const data = dataPendapatan(rentang);
  $("#gfPendapatan").innerHTML = Grafik.batang(data, Grafik.singkat);
  document.querySelectorAll("[data-aksi=rentang]").forEach((b) => b.classList.toggle("on", Number(b.dataset.id) === rentang));
}

function panelHome() {
  const lunas = transaksi.filter((t) => t.status === "lunas");
  const aktif = kos.filter((k) => k.status === "aktif");
  const sekarang = new Date();
  const lalu = new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, 1);
  const jumlah = (d) => d.reduce((s, t) => s + t.nominal, 0);
  const total = jumlah(lunas);
  const bulanIni = jumlah(lunas.filter((t) => t.dibayar_pada && bulanSama(t.dibayar_pada, sekarang)));
  const bulanLalu = jumlah(lunas.filter((t) => t.dibayar_pada && bulanSama(t.dibayar_pada, lalu)));
  const rata = lunas.length ? Math.round(total / lunas.length) : 0;
  const menungguBayar = transaksi.filter((t) => statusTransaksi(t) === "pending").length;

  // Pertumbuhan kos
  const tumbuh = dataPertumbuhan();

  // Status kos (semua pengajuan)
  const perStatus = hitungPer(kos, (k) => k.status);
  const bagianStatus = Object.entries(STATUS).map(([v, s]) => ({ label: s.label, nilai: perStatus[v] || 0, warna: WARNA_STATUS[v] }));

  // Tipe kos yang tayang
  const perTipe = hitungPer(aktif, (k) => k.tipe);
  const bagianTipe = ["Putra", "Putri", "Campur"].map((t, i) => ({ label: t, nilai: perTipe[t] || 0, warna: HIJAU[i] }));

  // Okupansi kamar pada kos yang tayang
  const kamar = aktif.flatMap((k) => k.kamar);
  const terisi = kamar.filter((m) => m.status === "terisi").length;
  const persen = kamar.length ? Math.round((terisi / kamar.length) * 100) : 0;

  // Pengguna per peran (bisa null jika tidak boleh dibaca)
  const peran = pengguna ? hitungPer(pengguna, (u) => u.role) : null;

  // Fasilitas terpopuler pada kos yang tayang
  const perFas = hitungPer(aktif.flatMap((k) => k.fasilitas), (f) => f.nama);
  const topFas = Object.entries(perFas).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([nama, n]) => ({ label: nama, nilai: n, teks: `${n} kos` }));

  // Sebaran harga kamar (per bulan) pada kos yang tayang
  const rentangHarga = [["< 500 rb", 0, 5e5], ["500 – 750 rb", 5e5, 75e4], ["750 rb – 1 jt", 75e4, 1e6], ["1 – 1,5 jt", 1e6, 15e5], ["> 1,5 jt", 15e5, Infinity]];
  const sebaran = rentangHarga.map(([label, a, b]) => ({ label, nilai: kamar.filter((m) => m.harga >= a && m.harga < b).length }))
    .map((r) => ({ ...r, teks: `${r.nilai} kamar` }));

  // Paket terlaris
  const paket = [1, 3, 12].map((b) => {
    const dp = lunas.filter((t) => t.bulan === b);
    return { label: `Paket ${b} bulan`, nilai: dp.length, teks: `${dp.length} · ${Grafik.singkat(jumlah(dp))}` };
  });

  // Pemilik dengan pendapatan tertinggi
  const perPemilik = {};
  lunas.forEach((t) => { const n = t.nama_pemilik || "-"; perPemilik[n] = (perPemilik[n] || 0) + t.nominal; });
  const kosPerPemilik = hitungPer(aktif, (k) => (k.pemilik ? k.pemilik.nama : "-"));
  const topPemilik = Object.entries(perPemilik).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Lima transaksi terbaru
  const terbaru = transaksi.slice(0, 5).map((t) => {
    const st = statusTransaksi(t);
    const kelas = { lunas: "st-aktif", pending: "st-menunggu", kedaluwarsa: "st-draft" }[st] || "st-draft";
    const label = { lunas: "Lunas", pending: "Menunggu", kedaluwarsa: "Kedaluwarsa" }[st] || st;
    const w = new Date(t.dibayar_pada || t.dibuat_pada);
    return `<tr><td><div class="hm-nama"><span class="hm-avatar">${esc(inisial(t.nama_kos))}</span><span>${esc(t.nama_kos)}</span></div></td>
      <td>${w.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
      <td>${w.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
      <td><span class="dash-badge ${kelas}">${label}</span></td><td><b>${rp(t.nominal)}</b></td></tr>`;
  }).join("");

  $("#panel").innerHTML = `
    <div class="hm-grid hm-g1">
      <div class="hm-kol">
        <div class="hm-kartu hm-hero">
          ${kepala("Total pendapatan", "Semua pembayaran lunas")}
          <p class="hm-besar">${rp(total)}</p>
          <div class="hm-dua"><div><span>Transaksi lunas</span><b>${lunas.length}</b></div><div><span>Menunggu bayar</span><b>${menungguBayar}</b></div></div>
        </div>
        <div class="hm-kartu hm-mini">
          <p class="hm-lbl">Pendapatan bulan ini</p>
          <p class="hm-nilai"><span>${rp(bulanIni)}</span>${lencana(bulanIni, bulanLalu)}</p>
          <p class="hm-lbl" style="margin-top:8px">Rata-rata per transaksi ${rp(rata)}</p>
        </div>
      </div>

      <div class="hm-kartu">
        <div class="hm-kepala"><div><h2>Pendapatan</h2><p>Pembayaran lunas per bulan</p></div>
          <div class="hm-seg" role="group" aria-label="Rentang waktu">
            <button type="button" data-aksi="rentang" data-id="6">6 bulan</button><button type="button" data-aksi="rentang" data-id="12">12 bulan</button></div></div>
        <div id="gfPendapatan"></div>
      </div>

      <div class="hm-kartu">
        ${kepala("Pertumbuhan kos", "Total kos terdaftar", "kos")}
        <p class="hm-besar" style="color:var(--ink);font-size:1.6rem;margin-bottom:6px">${kos.length} <span style="font-size:.8rem;font-weight:600;color:#5a687c">kos</span></p>
        ${Grafik.area(tumbuh)}
      </div>
    </div>

    <div class="hm-grid hm-g2">
      <div class="hm-kartu">
        ${kepala("Transaksi terbaru", "Lima pembayaran terakhir", "keuangan")}
        ${transaksi.length
          ? `<div class="hm-tabel-scroll"><table class="hm-tabel"><thead><tr><th>Kos</th><th>Tanggal</th><th>Jam</th><th>Status</th><th>Nominal</th></tr></thead><tbody>${terbaru}</tbody></table></div>`
          : '<p class="hm-kosong">Belum ada transaksi.</p>'}
      </div>
      <div class="hm-kartu">
        ${kepala("Status kos", "Semua pengajuan", "kos")}
        ${Grafik.donat(bagianStatus, { angka: kos.length, teks: "kos" })}
      </div>
    </div>

    <div class="hm-grid hm-g3">
      <div class="hm-kartu">
        ${kepala("Tipe kos", "Kos yang tayang")}
        ${Grafik.donat(bagianTipe, { angka: aktif.length, teks: "tayang" })}
      </div>
      <div class="hm-kartu">
        ${kepala("Okupansi kamar", "Kamar pada kos yang tayang")}
        ${Grafik.donat([
          { label: "Terisi", nilai: terisi, warna: "#006d43" },
          { label: "Tersedia", nilai: kamar.length - terisi, warna: "#c4ead6" },
        ], { angka: persen + "%", teks: "terisi" })}
      </div>
      <div class="hm-kartu">
        ${kepala("Pengguna", "Akun terdaftar")}
        ${peran
          ? Grafik.donat([
              { label: "Pencari kos", nilai: peran.pencari || 0, warna: "#00a86b" },
              { label: "Pemilik kos", nilai: peran.pemilik || 0, warna: "#006d43" },
              { label: "Admin", nilai: peran.admin || 0, warna: "#c4ead6" },
            ], { angka: pengguna.length, teks: "akun" })
          : '<p class="hm-kosong">Data pengguna tidak dapat dibaca oleh admin.</p>'}
      </div>
    </div>

    <div class="hm-grid hm-g3">
      <div class="hm-kartu">
        ${kepala("Fasilitas terpopuler", "Dipakai kos yang tayang")}
        ${Grafik.baris(topFas, "Belum ada fasilitas terpakai.")}
      </div>
      <div class="hm-kartu">
        ${kepala("Sebaran harga kamar", "Per bulan, kos yang tayang")}
        ${Grafik.baris(sebaran)}
      </div>
      <div class="hm-kartu">
        ${kepala("Paket terlaris", "Jumlah · pendapatan")}
        ${Grafik.baris(paket)}
      </div>
    </div>

    <div class="hm-kartu">
      ${kepala("Pemilik dengan pendapatan tertinggi", "Berdasarkan pembayaran lunas")}
      ${topPemilik.length
        ? `<ul class="hm-pemilik">${topPemilik.map(([nama, uang]) => `<li><span class="hm-avatar">${esc(inisial(nama))}</span>
            <div><b>${esc(nama)}</b><small>${kosPerPemilik[nama] || 0} kos tayang · ${rp(uang)}</small></div></li>`).join("")}</ul>`
        : '<p class="hm-kosong">Belum ada pembayaran.</p>'}
    </div>`;
  isiPendapatan();
}

// ---------- Konsol demo (khusus presentasi) ----------
// Mengatur sisa masa tayang kos supaya efek "masa tayang habis" bisa diperagakan tanpa menunggu berminggu-minggu.
function panelDemo() {
  const lunas = transaksi.filter((t) => t.status === "lunas");
  // Tanggal berakhir terjauh dari semua pembayaran lunas sebuah kos
  const sampaiKos = (id) => {
    const w = lunas.filter((t) => String(t.kos_id) === String(id)).map((t) => new Date(t.aktif_sampai).getTime());
    return w.length ? new Date(Math.max(...w)).toISOString() : null;
  };
  const aktif = kos.filter((k) => k.status === "aktif");
  const baris = aktif.map((k) => {
    const sampai = sampaiKos(k.id);
    const m = Pembayaran.masa(sampai);
    const kelas = { habis: "st-habis", segera: "st-menunggu", aman: "st-aktif", belum: "st-draft" }[m.status];
    const tombol = (hari, teks, bahaya) => `<button type="button" class="dash-btn ${bahaya ? "danger" : "ghost"}" data-aksi="demo-atur" data-id="${k.id}" data-hari="${hari}" ${sampai ? "" : "disabled"}>${teks}</button>`;
    return `<tr><td><b>${esc(k.nama)}</b></td><td>${esc(k.pemilik ? k.pemilik.nama : "-")}</td>
      <td>${sampai ? Pembayaran.tanggal(sampai) : "-"}</td>
      <td><span class="dash-badge ${kelas}">${esc(m.label)}</span></td>
      <td><div class="demo-aksi">${tombol(0, "Habiskan sekarang", true)}${tombol(3, "Sisa 3 hari")}${tombol(30, "Pulihkan 30 hari")}</div></td></tr>`;
  }).join("");

  $("#panel").innerHTML = `<div class="demo-banner"><span class="material-symbols-outlined">terminal</span>
      <div><b>Konsol Demo, hanya untuk presentasi.</b> Tombol di bawah mengubah tanggal berakhir masa tayang sebuah kos.
      <b>Habiskan sekarang</b> membuat kos hilang dari pencarian dan dashboard pemilik menampilkan peringatan merah.
      Pemilik lalu menekan <b>Perpanjang</b> dan membayar lewat QR; kos tayang kembali. <b>Pulihkan 30 hari</b> mengembalikan kos ke keadaan aman.</div></div>
    ${aktif.length
      ? `<div class="adm-scroll"><table class="adm-tabel"><thead><tr><th>Kos</th><th>Pemilik</th><th>Tayang sampai</th><th>Keadaan</th><th>Atur masa tayang</th></tr></thead><tbody>${baris}</tbody></table></div>`
      : '<p class="dash-empty">Belum ada kos yang tayang.</p>'}`;
}

// ---------- Pemuatan & tab ----------
async function muatKos() {
  kos = await Admin.semuaKos();
  const hitung = (st) => kos.filter((k) => k.status === st).length;
  $("#cAntrean").textContent = hitung("menunggu");
  // Isi angka pada kartu statistik (skeleton angka dihilangkan)
  document.querySelectorAll(".stat-n").forEach((e) => e.classList.remove("sk"));
  $("#sTotal").textContent = kos.length;
  $("#sAktif").textContent = hitung("aktif");
  $("#sMenunggu").textContent = hitung("menunggu");
  $("#sDitolak").textContent = hitung("ditolak");
}

// Menyesuaikan judul halaman & tampilan kotak sesuai tab yang dibuka
function aturKepala() {
  const home = tab === "home";
  $("#judulHalaman").textContent = home ? "Selamat datang, " + (profil.nama || "Admin") : "Ringkasan Admin";
  $("#subHalaman").textContent = home
    ? "Rekap seluruh data yang berjalan di RuangNyaman."
    : "Periksa kos yang diajukan, kelola fasilitas, dan pantau keuangan.";
  $("#barStat").hidden = home;                       // kartu statistik atas tidak perlu di Home (sudah ada di grafik)
  $("#kotakPanel").classList.toggle("bare", home);   // di Home, kartu berdiri sendiri tanpa kotak putih pembungkus
  const tgl = $("#tglHariIni");
  tgl.hidden = !home;
  tgl.textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

async function tampil() {
  document.querySelectorAll(".adm-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  aturKepala();
  try {
    await muatKos(); // selalu dimuat agar kartu statistik dan lencana antrean terbaru
    if (tab === "home") {
      // Data keuangan dan pengguna diambil bersamaan agar lebih cepat
      [transaksi, pengguna] = await Promise.all([Pembayaran.semua(), Admin.ringkasPengguna()]);
      panelHome();
    } else if (tab === "demo") { transaksi = await Pembayaran.semua(); panelDemo(); }
    else if (tab === "antrean") panelAntrean();
    else if (tab === "kos") panelKos();
    else if (tab === "keuangan") { transaksi = await Pembayaran.semua(); panelKeuangan(); }
    else { fasilitas = await Admin.daftarFasilitas(); panelFasilitas(); }
  } catch (err) {
    $("#panel").innerHTML = "";
    notif("Gagal memuat data: " + ((err && err.message) || "coba lagi."), "error");
  }
}

// ---------- Aksi ----------
const bukaDialog = () => { const d = $("#dlgTolak"); typeof d.showModal === "function" ? d.showModal() : d.setAttribute("open", ""); };
const tutupDialog = () => { const d = $("#dlgTolak"); typeof d.close === "function" ? d.close() : d.removeAttribute("open"); };

async function jalankan(aksi, id, elemen) {
  try {
    if (aksi === "ke-tab") { tab = id; notif(""); await tampil(); return; } // tombol panah di kartu Home
    if (aksi === "keu-lihat") { keuLihat = id; panelKeuangan(); return; }   // tombol Riwayat / Belum lunas
    if (aksi === "keu-jenis") { keuJenis = id; panelKeuangan(); return; }   // saringan daftar belum lunas
    if (aksi === "rentang") { rentang = Number(id); isiPendapatan(); return; }  // 6 / 12 bulan
    if (aksi === "setujui") {
      await Admin.setujui(id);
      await muatKos();
      const baru = kos.find((x) => String(x.id) === String(id));
      notif(
        baru && baru.status === "aktif"
          ? "Kos disetujui dan sekarang tayang di situs."
          : "Kos disetujui. Menunggu pembayaran biaya publikasi dari pemilik.",
      );
    } else if (aksi === "tolak") {
      const k = kos.find((x) => String(x.id) === String(id));
      tolakId = id;
      $("#judulTolak").textContent = (k.status === "aktif" ? "Turunkan kos: " : "Tolak kos: ") + k.nama;
      $("#alasanTolak").value = "";
      $("#errTolak").hidden = true;
      bukaDialog();
      return;
    } else if (aksi === "hapus") {
      const k = kos.find((x) => String(x.id) === String(id));
      if (!confirm(`Hapus kos "${k.nama}" beserta semua kamar dan fotonya? Tindakan ini tidak bisa dibatalkan.`)) return;
      await Admin.hapusKos(id);
      notif("Kos dihapus.");
    } else if (aksi === "rating") {
      const v = Number(document.querySelector(`[data-rating-input="${id}"]`).value);
      if (!Number.isFinite(v) || v < 0 || v > 5) return notif("Rating harus antara 0 dan 5.", "error");
      await Admin.aturRating(id, v);
      notif("Rating disimpan.");
    } else if (aksi === "demo-atur") {
      const k = kos.find((x) => String(x.id) === String(id));
      const hari = Number(elemen.dataset.hari);
      await Pembayaran.demoAtur(id, hari);
      notif(hari === 0
        ? `Masa tayang "${k.nama}" dihabiskan. Kos sudah hilang dari pencarian publik.`
        : `Masa tayang "${k.nama}" diatur menjadi sisa ${hari} hari.`);
    } else if (aksi === "fas-tambah") {
      const nama = $("#fasNama").value, kategori = $("#fasKategori").value;
      const e = Admin.validasiFasilitas(nama, kategori);
      if (e.length) return notif(e.join(" "), "error");
      await Admin.tambahFasilitas(nama, kategori);
      notif("Fasilitas ditambahkan.");
    } else if (aksi === "fas-simpan") {
      const baris = elemen.closest("tr");
      const nama = baris.querySelector("[data-f=nama]").value, kategori = baris.querySelector("[data-f=kategori]").value;
      const e = Admin.validasiFasilitas(nama, kategori);
      if (e.length) return notif(e.join(" "), "error");
      await Admin.ubahFasilitas(id, nama, kategori);
      notif("Fasilitas disimpan.");
    } else if (aksi === "fas-hapus") {
      const f = fasilitas.find((x) => String(x.id) === String(id));
      const n = f.kos_fasilitas && f.kos_fasilitas[0] ? f.kos_fasilitas[0].count : 0;
      if (!confirm(`Hapus fasilitas "${f.nama}"?${n ? ` Fasilitas ini akan dilepas dari ${n} kos.` : ""}`)) return;
      await Admin.hapusFasilitas(id);
      notif("Fasilitas dihapus.");
    }
    await tampil();
  } catch (err) {
    notif(galat(err), "error");
  }
}

$("#panel").addEventListener("click", (e) => {
  const b = e.target.closest("[data-aksi]");
  if (b && !b.disabled) jalankan(b.dataset.aksi, b.dataset.id, b);
});
$("#panel").addEventListener("input", (e) => {
  if (e.target.id === "cariKos") { cariTeks = e.target.value; isiDaftarKos(); }
});
$("#panel").addEventListener("change", (e) => {
  if (e.target.id === "filterStatus") { filterStatus = e.target.value; isiDaftarKos(); }
});
document.querySelectorAll(".adm-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; notif(""); tampil(); }));

$("#btnBatalTolak").addEventListener("click", tutupDialog);
$("#btnOkTolak").addEventListener("click", async () => {
  const alasan = $("#alasanTolak").value.trim();
  if (alasan.length < 5) { $("#errTolak").textContent = "Alasan wajib diisi (minimal 5 karakter)."; $("#errTolak").hidden = false; return; }
  $("#btnOkTolak").disabled = true;
  try {
    await Admin.tolak(tolakId, alasan);
    tutupDialog();
    notif("Kos ditolak. Pemilik akan melihat alasannya di dashboard.");
    await tampil();
  } catch (err) {
    $("#errTolak").textContent = galat(err);
    $("#errTolak").hidden = false;
  } finally {
    $("#btnOkTolak").disabled = false;
  }
});

(async function init() {
  profil = await Auth.require(["admin"]);
  if (!profil) return;
  if (profil.ditolak) {
    $("#app").innerHTML = '<p class="dash-empty">Halaman ini khusus admin.</p>';
    return;
  }
  await tampil();
})();