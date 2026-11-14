// Halaman bayar yang terbuka saat QR dipindai dari HP. Tidak perlu login (seperti pembayar QRIS).
// Tiga fungsi database dipakai: info_pembayaran (baca rincian) dan bayar_pembayaran (melunasi).

const $ = (s) => document.querySelector(s);
const kode = new URLSearchParams(location.search).get("kode") || "";
let info = null; // rincian transaksi dari database
let timer;

// Teks aman: nama kos berasal dari pengguna, jadi jangan disisipkan langsung ke innerHTML
const esc = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function hasil(jenis, ikon, judul, teks) {
  clearInterval(timer);
  $("#isi").innerHTML = `<div class="bayar-hasil ${jenis}">
    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">${ikon}</span>
    <h1>${judul}</h1><p>${teks}</p></div>`;
}

function tampilTagihan() {
  const lewat = new Date(info.kedaluwarsa_pada) - Date.now();
  if (info.status === "lunas")
    return hasil("ok", "check_circle", "Sudah dibayar", "Transaksi ini sudah lunas. Anda bisa menutup halaman ini.");
  if (info.status === "kedaluwarsa" || lewat <= 0)
    return hasil("gagal", "schedule", "QR sudah kedaluwarsa", "Kembali ke dashboard pemilik dan buat QR pembayaran yang baru.");

  $("#isi").innerHTML = `
    <p class="bayar-label">Total pembayaran</p>
    <p class="bayar-nominal">${rp(info.nominal)}</p>
    <dl class="bayar-rincian">
      <div><dt>Penerima</dt><dd>RuangNyaman</dd></div>
      <div><dt>Kos</dt><dd>${esc(info.nama_kos)}</dd></div>
      <div><dt>Biaya publikasi</dt><dd>${info.bulan} bulan</dd></div>
      <div><dt>Kode</dt><dd>${esc(kode)}</dd></div>
    </dl>
    <button type="button" class="bayar-btn" id="btnBayar">Bayar ${rp(info.nominal)}</button>
    <p class="bayar-sisa" id="sisa"></p>
    <p class="bayar-err" id="err" hidden></p>`;
  $("#btnBayar").addEventListener("click", bayar);

  // Hitung mundur sampai QR kedaluwarsa
  const tik = () => {
    const s = Math.max(0, Math.round((new Date(info.kedaluwarsa_pada) - Date.now()) / 1000));
    const el = $("#sisa");
    if (!el) return;
    if (s === 0) return tampilTagihan();
    el.textContent = `Selesaikan dalam ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  clearInterval(timer);
  tik();
  timer = setInterval(tik, 1000);
}

async function bayar() {
  const tombol = $("#btnBayar");
  tombol.disabled = true;
  tombol.textContent = "Memproses…";
  const { data, error } = await db.rpc("bayar_pembayaran", { p_kode: kode });
  if (error || !data) {
    tombol.disabled = false;
    tombol.textContent = "Bayar " + rp(info.nominal);
    const err = $("#err");
    err.hidden = false;
    err.textContent = (error && error.message) || "Pembayaran gagal. Coba lagi.";
    return;
  }
  hasil("ok", "check_circle", "Pembayaran berhasil", `${rp(info.nominal)} untuk ${esc(info.nama_kos)}. Kos akan tayang di RuangNyaman. Anda bisa menutup halaman ini.`);
}

(async function init() {
  if (!/^[A-Za-z0-9-]{6,40}$/.test(kode))
    return hasil("gagal", "error", "Kode tidak valid", "Pindai ulang QR dari dashboard pemilik.");
  const { data, error } = await db.rpc("info_pembayaran", { p_kode: kode });
  if (error || !data)
    return hasil("gagal", "error", "Transaksi tidak ditemukan", "Pindai ulang QR dari dashboard pemilik.");
  info = data;
  tampilTagihan();
})();