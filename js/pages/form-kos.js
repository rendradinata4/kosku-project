const $ = (s) => document.querySelector(s);
const idParam = new URLSearchParams(location.search).get("id");
const idKos = idParam && /^\d+$/.test(idParam) ? idParam : null; // null = kos baru

let profil, kosLama = null, map, marker;
const state = { lat: null, lng: null, kamar: [], aturan: [], fasilitasIds: new Set(), foto: [] };

function tampilPesan(daftar, jenis = "error") {
  const el = $("#msg");
  const arr = [].concat(daftar).filter(Boolean);
  el.innerHTML = arr.length === 1 ? esc(arr[0]) : "<ul>" + arr.map((t) => `<li>${esc(t)}</li>`).join("") + "</ul>";
  el.className = "dash-notif " + jenis;
  el.hidden = !arr.length;
  if (arr.length) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- Peta lokasi ----------
function setTitik(lat, lng) {
  state.lat = Number(lat.toFixed(7));
  state.lng = Number(lng.toFixed(7));
  if (marker) marker.setLatLng([lat, lng]);
  else {
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      setTitik(p.lat, p.lng);
    });
  }
  $("#koordinat").textContent = `${state.lat.toFixed(6)}, ${state.lng.toFixed(6)}`;
}

function initPeta(lat, lng) {
  map = L.map("pilihMap").setView([lat ?? -7.2756, lng ?? 112.7912], lat != null ? 16 : 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; kontributor OpenStreetMap",
  }).addTo(map);
  if (lat != null) setTitik(lat, lng);
  map.on("click", (e) => setTitik(e.latlng.lat, e.latlng.lng));
  // Pastikan Leaflet mengukur ulang wadahnya setelah tata letak halaman selesai
  setTimeout(() => map.invalidateSize(), 0);
}

// ---------- Fasilitas ----------
function renderFasilitas(daftar) {
  const grup = (kategori, judul) => {
    const item = daftar.filter((f) => f.kategori === kategori);
    return `<fieldset class="fas-grup"><legend>${judul}</legend>${item
      .map(
        (f) => `<label class="fas-item"><input type="checkbox" data-fid="${f.id}" ${state.fasilitasIds.has(f.id) ? "checked" : ""}> ${esc(f.nama)}</label>`,
      )
      .join("")}</fieldset>`;
  };
  $("#fasilitas").innerHTML = grup("kamar", "Fasilitas kamar") + grup("bersama", "Fasilitas bersama");
}

// ---------- Aturan ----------
function renderAturan() {
  $("#aturanList").innerHTML = state.aturan
    .map(
      (t, i) => `<div class="baris-aturan"><input data-ai="${i}" value="${esc(t)}" placeholder="Contoh: Tamu maksimal pukul 21.00" aria-label="Aturan ${i + 1}">
      <button type="button" class="x" data-hapus-aturan="${i}" aria-label="Hapus aturan">✕</button></div>`,
    )
    .join("");
}

// ---------- Kamar ----------
function nomorBerikut() {
  const dipakai = new Set(state.kamar.map((k) => String(k.nomor_kamar).trim().toLowerCase()));
  let n = state.kamar.length + 1;
  const buat = (i) => "A" + String(i).padStart(2, "0");
  while (dipakai.has(buat(n).toLowerCase())) n++;
  return buat(n);
}

function renderKamar() {
  $("#kamarBody").innerHTML = state.kamar
    .map(
      (k, i) => `<tr>
      <td><input data-k="nomor_kamar" data-i="${i}" value="${esc(k.nomor_kamar)}" aria-label="Nomor kamar"></td>
      <td><input data-k="harga" data-i="${i}" inputmode="numeric" value="${k.harga || ""}" placeholder="1200000" aria-label="Harga per bulan"></td>
      <td><select data-k="status" data-i="${i}" aria-label="Status kamar">
        <option value="tersedia" ${k.status === "tersedia" ? "selected" : ""}>Tersedia</option>
        <option value="terisi" ${k.status === "terisi" ? "selected" : ""}>Terisi</option></select></td>
      <td><button type="button" class="x" data-hapus-kamar="${i}" aria-label="Hapus kamar">✕</button></td></tr>`,
    )
    .join("");
  $("#kamarKosong").hidden = state.kamar.length > 0;
  $("#kamarTabel").hidden = state.kamar.length === 0;
}

// ---------- Foto ----------
// state.foto: urutan foto di form. Isi: { id, path, urutan, url } (sudah tersimpan) atau { file, url } (baru).
function renderFoto() {
  $("#fotoGrid").innerHTML = state.foto
    .map(
      (f, i) => `<figure class="foto-item">
      <img src="${esc(f.url)}" alt="Foto ${i + 1}">
      ${i === 0 ? '<span class="foto-utama">Utama</span>' : `<button type="button" class="foto-btn" data-utama="${i}">Jadikan utama</button>`}
      <button type="button" class="foto-x" data-hapus-foto="${i}" aria-label="Hapus foto">✕</button></figure>`,
    )
    .join("");
  $("#fotoKosong").hidden = state.foto.length > 0;
}

const JENIS_FOTO = /^image\/(jpeg|png|webp)$/;
const MAKS_UKURAN_ASLI = 15 * 1024 * 1024;

// ---------- Baca form & simpan ----------
function bacaForm() {
  const g = (n) => document.querySelector(`[name=${n}]`).value;
  return {
    nama: g("nama"),
    tipe: g("tipe"),
    deskripsi: g("deskripsi"),
    alamat: g("alamat"),
    jarak_terdekat: g("jarak_terdekat"),
    no_whatsapp: Owner.normalisasiWa(g("no_whatsapp")),
    latitude: state.lat === null ? NaN : state.lat,
    longitude: state.lng === null ? NaN : state.lng,
    fasilitasIds: [...state.fasilitasIds],
    aturan: state.aturan,
    kamar: state.kamar,
    foto: state.foto,
  };
}

function terjemah(err) {
  if (err && err.code === "23505") return "Nomor kamar sudah dipakai di kos ini.";
  return "Gagal menyimpan: " + ((err && err.message) || "coba lagi.");
}

async function simpan(ajukan) {
  tampilPesan([]);
  const f = bacaForm();
  const galat = Owner.validasi(f, ajukan);
  if (galat.length) return tampilPesan(galat);

  const tombol = document.querySelectorAll("[data-simpan]");
  tombol.forEach((b) => (b.disabled = true));
  if (state.foto.some((x) => x.file)) tampilPesan("Menyimpan… mengunggah foto bisa memakan waktu beberapa detik.", "info");
  try {
    let kode = ajukan ? "diajukan" : "disimpan";
    if (idKos) {
      const akhir = await Owner.simpanUbah(idKos, f, ajukan, profil.id);
      if (!ajukan && kosLama.status === "aktif" && akhir === "menunggu") kode = "perlu-persetujuan";
    } else {
      await Owner.simpanBaru(profil.id, f, ajukan);
    }
    location.href = "dashboard.html?pesan=" + kode;
  } catch (err) {
    tampilPesan(terjemah(err));
    tombol.forEach((b) => (b.disabled = false));
  }
}

// ---------- Isi form saat mengubah ----------
function isiForm(k) {
  const set = (n, v) => (document.querySelector(`[name=${n}]`).value = v ?? "");
  set("nama", k.nama);
  set("tipe", k.tipe);
  set("deskripsi", k.deskripsi);
  set("alamat", k.alamat);
  set("jarak_terdekat", k.jarak_terdekat);
  set("no_whatsapp", k.no_whatsapp);
  state.fasilitasIds = new Set(k.kos_fasilitas.map((x) => x.fasilitas_id));
  state.aturan = [...k.aturan].sort((a, b) => a.urutan - b.urutan).map((a) => a.isi);
  state.kamar = [...k.kamar]
    .sort((a, b) => String(a.nomor_kamar).localeCompare(String(b.nomor_kamar), undefined, { numeric: true }))
    .map((x) => ({ id: x.id, nomor_kamar: x.nomor_kamar, harga: x.harga, status: x.status }));
  state.foto = [...(k.kos_gambar || [])]
    .sort((a, b) => a.urutan - b.urutan)
    .map((x) => ({ id: x.id, path: x.path, urutan: x.urutan, url: Owner.urlFoto(x.path) }));
}

function aturTombol() {
  const bisaAjukan = !kosLama || kosLama.status === "draft" || kosLama.status === "ditolak";
  $("#btnAjukan").hidden = !bisaAjukan;
  $("#btnDraft").textContent = bisaAjukan ? "Simpan draft" : "Simpan perubahan";
  if (kosLama) {
    $("#judul").textContent = "Ubah Kos";
    if (kosLama.status === "ditolak") {
      $("#alasan").hidden = false;
      $("#alasan").innerHTML = `<b>Kos ini ditolak admin.</b> Alasan: ${esc(kosLama.alasan_penolakan || "-")}`;
    } else if (kosLama.status === "aktif") {
      $("#alasan").hidden = false;
      $("#alasan").className = "dash-notif info";
      $("#alasan").textContent =
        "Kos ini sedang tayang. Mengubah nama, alamat, lokasi, tipe, atau deskripsi akan mengembalikannya ke status menunggu persetujuan. Perubahan kamar dan harga langsung berlaku.";
    }
  }
}

// ---------- Event ----------
$("#fasilitas").addEventListener("change", (e) => {
  const c = e.target.closest("[data-fid]");
  if (!c) return;
  const fid = Number(c.dataset.fid);
  c.checked ? state.fasilitasIds.add(fid) : state.fasilitasIds.delete(fid);
});

$("#aturanList").addEventListener("input", (e) => {
  if (e.target.dataset.ai !== undefined) state.aturan[Number(e.target.dataset.ai)] = e.target.value;
});
$("#aturanList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hapus-aturan]");
  if (!b) return;
  state.aturan.splice(Number(b.dataset.hapusAturan), 1);
  renderAturan();
});
$("#btnTambahAturan").addEventListener("click", () => {
  state.aturan.push("");
  renderAturan();
  const inputs = document.querySelectorAll("#aturanList input");
  inputs[inputs.length - 1].focus();
});

$("#kamarBody").addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.k === undefined) return;
  const k = state.kamar[Number(el.dataset.i)];
  if (el.dataset.k === "harga") k.harga = Number(String(el.value).replace(/\D/g, ""));
  else k[el.dataset.k] = el.value;
});
$("#kamarBody").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hapus-kamar]");
  if (!b) return;
  state.kamar.splice(Number(b.dataset.hapusKamar), 1);
  renderKamar();
});
$("#btnTambahKamar").addEventListener("click", () => {
  const terakhir = state.kamar[state.kamar.length - 1];
  state.kamar.push({ nomor_kamar: nomorBerikut(), harga: terakhir ? terakhir.harga : 0, status: "tersedia" });
  renderKamar();
});
$("#btnSamakanHarga").addEventListener("click", () => {
  if (!state.kamar.length) return;
  const h = state.kamar[0].harga;
  state.kamar.forEach((k) => (k.harga = h));
  renderKamar();
});

// Tambah foto dari daftar file (dipakai oleh tombol pilih file dan drag & drop)
function tambahFoto(files) {
  const galat = [];
  for (const file of files) {
    if (state.foto.length >= Owner.MAKS_FOTO) galat.push(`Maksimal ${Owner.MAKS_FOTO} foto per kos.`);
    else if (!JENIS_FOTO.test(file.type)) galat.push(`"${file.name}" bukan JPG, PNG, atau WebP.`);
    else if (file.size > MAKS_UKURAN_ASLI) galat.push(`"${file.name}" lebih dari 15 MB.`);
    else state.foto.push({ file, url: URL.createObjectURL(file) });
  }
  renderFoto();
  if (galat.length) tampilPesan([...new Set(galat)]);
}

$("#fotoInput").addEventListener("change", (e) => {
  tambahFoto([...e.target.files]); // salin dulu, karena input dikosongkan setelahnya
  e.target.value = "";
});

// Drag & drop: area lepas foto
const zona = $("#dropFoto");
// Cegah browser membuka file bila terlepas di luar area (mis. di sela-sela form)
["dragover", "drop"].forEach((ev) => window.addEventListener(ev, (e) => e.preventDefault()));
zona.addEventListener("dragover", (e) => {
  e.preventDefault();
  zona.classList.add("over"); // beri sorotan saat file diseret di atas area
});
["dragleave", "dragend"].forEach((ev) =>
  zona.addEventListener(ev, () => zona.classList.remove("over")),
);
zona.addEventListener("drop", (e) => {
  e.preventDefault();
  zona.classList.remove("over");
  tambahFoto([...e.dataTransfer.files]);
});
$("#fotoGrid").addEventListener("click", (e) => {
  const utama = e.target.closest("[data-utama]");
  const hapus = e.target.closest("[data-hapus-foto]");
  if (utama) {
    const [f] = state.foto.splice(Number(utama.dataset.utama), 1);
    state.foto.unshift(f);
    renderFoto();
  } else if (hapus) {
    const [f] = state.foto.splice(Number(hapus.dataset.hapusFoto), 1);
    if (f.file) URL.revokeObjectURL(f.url);
    renderFoto();
  }
});

$("#btnDraft").addEventListener("click", () => simpan(false));
$("#btnAjukan").addEventListener("click", () => simpan(true));

// ---------- Mulai ----------
(async function init() {
  profil = await Auth.require(["pemilik"]);
  if (!profil) return;
  if (profil.ditolak) {
    $("#app").innerHTML = '<p class="dash-empty">Halaman ini khusus akun pemilik kos.</p>';
    return;
  }
  if (idParam && !idKos) {
    $("#app").innerHTML = '<p class="dash-empty">Kos tidak ditemukan. <a href="dashboard.html">Kembali ke dashboard</a></p>';
    return;
  }
  try {
    const [fas, kos] = await Promise.all([Owner.fasilitas(), idKos ? Owner.ambilKos(idKos, profil.id) : null]);
    if (idKos && !kos) {
      $("#app").innerHTML = '<p class="dash-empty">Kos tidak ditemukan atau bukan milik Anda. <a href="dashboard.html">Kembali ke dashboard</a></p>';
      return;
    }
    kosLama = kos;
    if (kos) isiForm(kos);
    // Kos baru: isi nomor WhatsApp dari nomor yang didaftarkan saat membuat akun (boleh dikosongkan)
    else if (profil.no_telepon) document.querySelector("[name=no_whatsapp]").value = profil.no_telepon;
    renderFasilitas(fas);
    renderAturan();
    renderKamar();
    renderFoto();
    aturTombol();
    // Form harus tampil dulu: peta yang dibuat di dalam wadah tersembunyi mengukur ukurannya sebagai 0
    $("#formWrap").hidden = false;
    initPeta(kos ? kos.latitude : null, kos ? kos.longitude : null);
  } catch (err) {
    tampilPesan("Gagal memuat form: " + ((err && err.message) || "coba lagi."));
    $("#formWrap").hidden = false;
  }
})();