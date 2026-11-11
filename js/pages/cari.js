const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let DATA = [];
let sortMode = "Rekomendasi";
let selectedId = null;

function sortData(list) {
  const l = [...list];
  if (sortMode === "Harga Terendah")
    l.sort((a, b) => a.hargaBulanan - b.hargaBulanan);
  else if (sortMode === "Rating Tertinggi")
    l.sort((a, b) => b.rating - a.rating);
  else if (sortMode === "Terdekat") l.sort((a, b) => km(a, TUGU) - km(b, TUGU));
  else if (sortMode === "Terdekat kampus" && Filter.kampusAktif()) {
    const c = Filter.kampusAktif();
    l.sort((a, b) => km(a, c) - km(b, c));
  }
  else l.sort((a, b) => b.rating - a.rating); // Rekomendasi
  return l;
}

function card(k) {
  const low = k.sisaKamar <= 2;
  const kp = Filter.kampusAktif(); // jika kampus dipilih, tampilkan jaraknya di kartu
  const jarak = kp
    ? `${km(k, kp).toFixed(1).replace(".", ",")} km dari ${kp.nama} · ${k.jarakTerdekat}`
    : k.jarakTerdekat;
  return `<article class="kos-card" data-id="${k.id}">
    <div class="kos-card-content">
      <div class="card-thumb-wrap">
        <img class="card-thumb-img" src="${k.gambarUtama}" alt="${k.nama}" loading="lazy">
        <div class="card-badges-top"><span class="badge-gender badge-gender-${GKEY[k.tipe]}">${k.tipe}</span></div>
        <button class="btn-fav ${Fav.has(k.id) ? "active" : ""}" data-fav="${k.id}" aria-label="Simpan ke favorit">${icon("favorite")}</button>
      </div>
      <div class="card-body">
        <div>
          <div class="card-rating-stock-row">
            <span class="rating-wrap">${icon("star")}<span class="rating-num">${k.rating}</span></span>
            <span class="${low ? "stock-badge-red" : "stock-badge-gray"}">Sisa ${k.sisaKamar} Kamar</span>
          </div>
          <h3 class="card-title">${k.nama}</h3>
          <p class="card-location">${icon("distance")}<span>${jarak}</span></p>
          <div class="facilities-chip-list">${k.fasilitas
            .slice(0, 3)
            .map((f) =>
              AM[f]
                ? `<span class="facility-chip">${icon(AM[f])} ${f}</span>`
                : "",
            )
            .join("")}</div>
        </div>
        <div class="card-footer-row">
          <div><span class="price-text">${rp(k.hargaBulanan)}</span><span class="price-period"> / bulan</span></div>
          <div style="display:flex;gap:6px">
            <a class="btn-wa-mini" href="${waLink(k)}" target="_blank" rel="noopener" aria-label="Hubungi via WhatsApp" onclick="event.stopPropagation()">${icon("chat")}</a>
            <a class="btn-action-primary" href="detail.html?id=${k.id}">Lihat Unit</a>
          </div>
        </div>
      </div>
    </div></article>`;
}

function popupHtml(k) {
  return `<div class="popup-thumb-wrap"><img class="popup-img" src="${k.gambarUtama}" alt="${k.nama}">
    <span class="popup-badge-bottom">${k.tipe} · ${icon("star")} ${k.rating}</span></div>
    <h4 class="popup-title">${k.nama}</h4><p class="popup-subtitle">${k.jarakTerdekat}</p>
    <div class="popup-footer"><span class="popup-price">${rp(k.hargaBulanan)}</span>
    <a class="popup-link-btn" href="detail.html?id=${k.id}">Detail ${icon("arrow_forward")}</a></div>`;
}

let tagList = []; // filter aktif yang bisa dihapus satu per satu

function updateStats() {
  const s = Filter.state;
  tagList = Filter.tags();
  const n = tagList.length + (s.favOnly ? 1 : 0);
  $("#statsText").innerHTML =
    `<span class="dot"></span>${n ? n + " Filter Diterapkan" : "Tidak ada filter"}`;
  // Lencana angka di tombol Filter
  $("#fBadge").textContent = tagList.length;
  $("#fBadge").hidden = !tagList.length;
  // Label filter aktif (klik untuk menghapus)
  $("#activeTags").innerHTML = tagList
    .map((t, i) => `<button type="button" class="chip on" data-tag="${i}" title="Hapus filter">${t.label}${icon("close").replace("material-symbols-outlined", "material-symbols-outlined x-ic")}</button>`)
    .join("");
  // Tombol terapan di panel menampilkan jumlah hasil
  const jumlah = Filter.apply(DATA).length;
  $("#fApply").textContent = `Tampilkan ${jumlah} kos`;
  // Sorot preset harga yang sedang dipakai
  $$("#fPreset .chip").forEach((c) => {
    const mn = +c.dataset.min, mx = c.dataset.max ? +c.dataset.max : Infinity;
    c.classList.toggle("on", s.min === mn && s.max === mx);
  });
}

function render() {
  const list = sortData(Filter.apply(DATA));
  $("#count").textContent = list.length + " Kos Ditemukan";
  $("#cards").innerHTML = list.length
    ? list.map(card).join("")
    : '<p class="empty">Tidak ada kos yang cocok. Coba ubah atau reset filter.</p>';
  updateStats();
  Maps.setMarkers(list, popupHtml);
  if (selectedId && !list.some((k) => k.id === selectedId)) selectedId = null;
  $("#favCount").textContent = Fav.get().length;
}

function selectCard(id) {
  $$(".kos-card.selected-ring").forEach((c) => {
    c.classList.remove("selected-ring");
    const b = c.querySelector(".badge-chosen");
    if (b) b.remove();
  });
  const el = document.querySelector(`.kos-card[data-id="${id}"]`);
  if (el) {
    el.classList.add("selected-ring");
    el.querySelector(".card-badges-top").insertAdjacentHTML(
      "beforeend",
      '<span class="badge-chosen">Dipilih</span>',
    );
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  Maps.highlight(selectedId, false);
  Maps.highlight(id, true);
  selectedId = id;
}

function search(q) {
  q = q.trim();
  $("#q").value = q;
  Filter.state.q = q;
  if (q && !Filter.apply(DATA).length) {
    // nama tidak cocok: anggap nama lokasi, geser peta
    Filter.state.q = "";
    render();
    Maps.geocode(q);
  } else render();
}

// --- Ganti tampilan Daftar <-> Peta (khusus HP & tablet) ---
const split = $(".split"); // pembungkus daftar + peta
const mapToggle = $("#mapToggle"); // tombol "Peta" / "Daftar"
// true jika layar lebih sempit dari 1024px (sama dengan batas di cari.css)
const isMobile = () => window.matchMedia("(max-width: 1023px)").matches;

function setMapView(on) {
  split.classList.toggle("show-map", on); // pasang/lepas class; CSS yang menampilkan peta
  mapToggle.setAttribute("aria-pressed", on); // info untuk screen reader
  mapToggle.querySelector(".toggle-icon").textContent = on ? "list" : "map"; // ganti ikon
  mapToggle.querySelector(".toggle-label").textContent = on ? "Daftar" : "Peta"; // ganti teks
  if (on) Maps.map.invalidateSize(); // suruh Leaflet menghitung ulang ukuran petanya
}
mapToggle.addEventListener("click", () => {
  setMapView(!split.classList.contains("show-map")); // kalau sedang peta -> daftar, dan sebaliknya
});

// --- Dropdown generik ---
function closeDropdowns() {
  $$(".dropdown.open").forEach((d) => d.classList.remove("open"));
}
$$(".dropdown > button").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = btn.parentElement,
      wasOpen = dd.classList.contains("open");
    closeDropdowns();
    if (!wasOpen) dd.classList.add("open");
  });
});
document.addEventListener("click", closeDropdowns);

// Sort
function setSort(mode) {
  sortMode = mode;
  $("#sortLabel").textContent = mode;
  $$("#sortDD .check").forEach((c) => c.remove());
  $(`#sortDD [data-sort="${mode}"]`).insertAdjacentHTML(
    "beforeend",
    '<span class="material-symbols-outlined check">check</span>',
  );
}
$("#sortDD .menu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sort]");
  if (!b) return;
  setSort(b.dataset.sort);
  closeDropdowns();
  render();
});

// ---------- Panel filter lengkap ----------
let OPSI_FAS = [], OPSI_BERSAMA = []; // nama fasilitas yang ada di data (sudah di-escape)

// Isi daftar kampus dan daftar fasilitas dari data yang dimuat
function buildFilterOptions() {
  $("#fKampus").innerHTML =
    '<option value="">Semua lokasi</option>' +
    KAMPUS.map((c) => `<option value="${c.id}">${c.nama}</option>`).join("");
  const unik = (key) => [...new Set(DATA.flatMap((k) => k[key]))].sort((a, b) => a.localeCompare(b, "id"));
  OPSI_FAS = unik("fasilitas");
  OPSI_BERSAMA = unik("bersama");
  // data-i = nomor di array, supaya nama fasilitas tidak perlu dibaca ulang dari atribut HTML
  const kotak = (arr, grup) =>
    arr.map((f, i) => `<label class="f-check"><input type="checkbox" data-grup="${grup}" data-i="${i}"><span>${f}</span></label>`).join("") ||
    '<p class="f-note">Belum ada data.</p>';
  $("#fFas").innerHTML = kotak(OPSI_FAS, "fas");
  $("#fBersama").innerHTML = kotak(OPSI_BERSAMA, "bersama");
}

// Samakan tampilan panel dengan Filter.state (dipakai saat reset / hapus label / awal muat)
function syncPanel() {
  const s = Filter.state;
  $$("#fTipe .chip").forEach((c) => c.classList.toggle("on", c.dataset.tipe === s.tipe));
  $("#fMin").value = s.min || "";
  $("#fMax").value = s.max < Infinity ? s.max : "";
  $("#fKampus").value = s.kampus;
  $("#fRadius").value = String(s.radius);
  $("#fRadiusRow").hidden = !s.kampus;
  $$("#fRating .chip").forEach((c) => c.classList.toggle("on", +c.dataset.rating === s.rating));
  $("#fTersedia").checked = s.tersedia;
  $$("#fFas input, #fBersama input").forEach((i) => {
    const arr = i.dataset.grup === "fas" ? OPSI_FAS : OPSI_BERSAMA;
    i.checked = s[i.dataset.grup].includes(arr[i.dataset.i]);
  });
  $("#favChip").classList.toggle("on", s.favOnly);
}

function bukaPanel(buka) {
  $("#fDrawer").hidden = !buka;
  $("#fOverlay").hidden = !buka;
  document.body.classList.toggle("f-open", buka);
  if (buka) $("#fClose").focus();
}
$("#fBtn").addEventListener("click", () => bukaPanel(true));
$("#fClose").addEventListener("click", () => bukaPanel(false));
$("#fApply").addEventListener("click", () => bukaPanel(false));
$("#fOverlay").addEventListener("click", () => bukaPanel(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#fDrawer").hidden) bukaPanel(false);
});

// Tipe
$("#fTipe").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tipe]");
  if (!b) return;
  Filter.state.tipe = b.dataset.tipe;
  syncPanel();
  render();
});

// Harga: kolom angka + pilihan cepat
function setHarga() {
  Filter.state.min = +$("#fMin").value || 0;
  Filter.state.max = +$("#fMax").value || Infinity;
  render();
}
$("#fMin").addEventListener("input", setHarga);
$("#fMax").addEventListener("input", setHarga);
$("#fPreset").addEventListener("click", (e) => {
  const b = e.target.closest("[data-min]");
  if (!b) return;
  const aktif = b.classList.contains("on"); // klik lagi = lepas pilihan
  Filter.state.min = aktif ? 0 : +b.dataset.min;
  Filter.state.max = aktif || !b.dataset.max ? Infinity : +b.dataset.max;
  syncPanel();
  render();
});

// Kampus + radius
$("#fKampus").addEventListener("change", (e) => {
  Filter.state.kampus = e.target.value;
  $("#fRadiusRow").hidden = !e.target.value;
  // Otomatis urutkan dari yang terdekat ke kampus (kembali ke semula jika kampus dilepas)
  if (e.target.value && sortMode === "Rekomendasi") setSort("Terdekat kampus");
  if (!e.target.value && sortMode === "Terdekat kampus") setSort("Rekomendasi");
  render();
});
$("#fRadius").addEventListener("change", (e) => {
  Filter.state.radius = +e.target.value;
  render();
});

// Fasilitas kamar & bersama (kotak centang)
function onFasilitas(e) {
  const i = e.target.closest("input[data-grup]");
  if (!i) return;
  const arr = i.dataset.grup === "fas" ? OPSI_FAS : OPSI_BERSAMA;
  const nama = arr[i.dataset.i];
  const daftar = Filter.state[i.dataset.grup].filter((x) => x !== nama);
  if (i.checked) daftar.push(nama);
  Filter.state[i.dataset.grup] = daftar;
  render();
}
$("#fFas").addEventListener("change", onFasilitas);
$("#fBersama").addEventListener("change", onFasilitas);

// Rating & ketersediaan
$("#fRating").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rating]");
  if (!b) return;
  Filter.state.rating = +b.dataset.rating;
  syncPanel();
  render();
});
$("#fTersedia").addEventListener("change", (e) => {
  Filter.state.tersedia = e.target.checked;
  render();
});

// Favorit (chip di bar atas)
$("#favChip").addEventListener("click", () => {
  Filter.state.favOnly = !Filter.state.favOnly;
  syncPanel();
  render();
});

// Hapus satu filter lewat label di bar atas
$("#activeTags").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tag]");
  if (!b) return;
  tagList[+b.dataset.tag].hapus();
  if (!Filter.state.kampus && sortMode === "Terdekat kampus") setSort("Rekomendasi");
  syncPanel();
  render();
});

// Reset semua (kata kunci pencarian di kotak atas tetap dipertahankan)
function resetFilter() {
  const q = Filter.state.q;
  Filter.state = Filter.awal();
  Filter.state.q = q;
  if (sortMode === "Terdekat kampus") setSort("Rekomendasi");
  syncPanel();
  render();
}
$("#resetBtn").addEventListener("click", resetFilter);
$("#fReset").addEventListener("click", resetFilter);

// Pencarian
$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  search($("#q").value);
});

// Kartu: klik hati = favorit, klik tombol detail = navigasi biasa, klik lainnya = fokus ke peta
$("#cards").addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) {
    fav.classList.toggle("active", Fav.toggle(fav.dataset.fav));
    $("#favCount").textContent = Fav.get().length;
    if (Filter.state.favOnly) render();
    return;
  }
  if (e.target.closest(".btn-action-primary")) return; // biarkan tautan detail bekerja normal
  const c = e.target.closest(".kos-card");
  if (!c) return;
  selectCard(c.dataset.id);
  if (isMobile()) setMapView(true); // di HP, peta tersembunyi, jadi tampilkan dulu
  Maps.focus(c.dataset.id);
});

// --- Inisialisasi ---
Maps.init((id) => selectCard(id));

getAllKos()
  .then((d) => {
    DATA = d;
    buildFilterOptions();
    const p = new URLSearchParams(location.search);
    if (["Putri", "Putra", "Campur"].includes(p.get("tipe"))) Filter.state.tipe = p.get("tipe");
    if (KAMPUS.some((c) => c.id === p.get("kampus"))) {
      Filter.state.kampus = p.get("kampus");
      setSort("Terdekat kampus");
    }
    if (p.get("fav")) Filter.state.favOnly = true;
    syncPanel();
    const q = p.get("q");
    q ? search(q) : render();
  })
  .catch(() => {
    $("#cards").innerHTML =
      '<p class="empty">Data gagal dimuat. Jalankan lewat Live Server.</p>';
  });