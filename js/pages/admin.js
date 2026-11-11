const $ = (s) => document.querySelector(s);

const STATUS = {
  draft: { label: "Draft", kelas: "st-draft" },
  menunggu: { label: "Menunggu persetujuan", kelas: "st-menunggu" },
  aktif: { label: "Tayang", kelas: "st-aktif" },
  ditolak: { label: "Ditolak", kelas: "st-ditolak" },
};
const urut = (a) => [...a].sort((x, y) => x.urutan - y.urutan);

let profil;
let tab = "antrean";
let kos = [], fasilitas = [];
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

// ---------- Pemuatan & tab ----------
async function muatKos() {
  kos = await Admin.semuaKos();
  const hitung = (st) => kos.filter((k) => k.status === st).length;
  $("#cAntrean").textContent = hitung("menunggu");
  // Isi angka pada kartu statistik
  $("#sTotal").textContent = kos.length;
  $("#sAktif").textContent = hitung("aktif");
  $("#sMenunggu").textContent = hitung("menunggu");
  $("#sDitolak").textContent = hitung("ditolak");
}

async function tampil() {
  document.querySelectorAll(".adm-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  try {
    await muatKos(); // selalu dimuat agar kartu statistik dan lencana antrean terbaru
    if (tab === "antrean") panelAntrean();
    else if (tab === "kos") panelKos();
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
    if (aksi === "setujui") {
      await Admin.setujui(id);
      notif("Kos disetujui dan sekarang tayang di situs.");
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