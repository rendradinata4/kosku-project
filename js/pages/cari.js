const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const PRICES = [500000, 800000, 1000000, 1500000, 2000000, 3000000];

let DATA = [];
let sortMode = "Rekomendasi";
let selectedId = null;

function buildPriceSelects() {
  const opt = (v, t) => `<option value="${v}">${t}</option>`;
  $("#fMin").innerHTML =
    opt(0, "Rp min") + PRICES.map((p) => opt(p, "≥ " + rp(p))).join("");
  $("#fMax").innerHTML =
    opt("", "Rp maks") + PRICES.map((p) => opt(p, "≤ " + rp(p))).join("");
}

function sortData(list) {
  const l = [...list];
  if (sortMode === "Harga Terendah")
    l.sort((a, b) => a.hargaBulanan - b.hargaBulanan);
  else if (sortMode === "Rating Tertinggi")
    l.sort((a, b) => b.rating - a.rating);
  else if (sortMode === "Terdekat") l.sort((a, b) => km(a, TUGU) - km(b, TUGU));
  else l.sort((a, b) => b.rating - a.rating); // Rekomendasi
  return l;
}

function card(k) {
  const low = k.sisaKamar <= 2;
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
          <p class="card-location">${icon("distance")}<span>${k.jarakTerdekat}</span></p>
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

function updateStats() {
  const s = Filter.state;
  const n =
    (s.tipe ? 1 : 0) +
    (s.min > 0 || s.max < Infinity ? 1 : 0) +
    s.fas.length +
    (s.favOnly ? 1 : 0);
  $("#statsText").innerHTML =
    `<span class="dot"></span>${n ? n + " Filter Diterapkan" : "Tidak ada filter"}`;
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
$("#hargaDD .menu").addEventListener("click", (e) => e.stopPropagation());

// Sort
$("#sortDD .menu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sort]");
  if (!b) return;
  sortMode = b.dataset.sort;
  $("#sortLabel").textContent = sortMode;
  $$("#sortDD .check").forEach((c) => c.remove());
  b.insertAdjacentHTML(
    "beforeend",
    '<span class="material-symbols-outlined check">check</span>',
  );
  closeDropdowns();
  render();
});

// Tipe
$("#tipeDD .menu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tipe]");
  if (!b) return;
  Filter.state.tipe = b.dataset.tipe;
  $("#tipeLabel").textContent = "Tipe: " + (b.dataset.tipe || "Semua");
  $("#tipeDD").classList.toggle("active", !!b.dataset.tipe);
  closeDropdowns();
  render();
});

// Harga
$("#hargaApply").addEventListener("click", () => {
  const min = +$("#fMin").value,
    max = +$("#fMax").value || Infinity;
  Filter.state.min = min;
  Filter.state.max = max;
  $("#hargaLabel").textContent =
    min || max < Infinity
      ? `${rp(min)} – ${max < Infinity ? rp(max) : "∞"}`
      : "Semua Harga";
  $("#hargaDD").classList.toggle("active", min > 0 || max < Infinity);
  closeDropdowns();
  render();
});

// Fasilitas & favorit (chip toggle)
$$(".chip[data-fas]").forEach((c) =>
  c.addEventListener("click", () => {
    const f = c.dataset.fas,
      i = Filter.state.fas.indexOf(f);
    i > -1 ? Filter.state.fas.splice(i, 1) : Filter.state.fas.push(f);
    c.classList.toggle("on");
    render();
  }),
);
$("#favChip").addEventListener("click", () => {
  Filter.state.favOnly = !Filter.state.favOnly;
  $("#favChip").classList.toggle("on");
  render();
});

// Reset semua
$("#resetBtn").addEventListener("click", () => {
  Filter.state = {
    q: Filter.state.q,
    tipe: "",
    min: 0,
    max: Infinity,
    fas: [],
    favOnly: false,
  };
  $("#tipeLabel").textContent = "Tipe: Semua";
  $("#tipeDD").classList.remove("active");
  $("#hargaLabel").textContent = "Semua Harga";
  $("#hargaDD").classList.remove("active");
  $("#fMin").value = 0;
  $("#fMax").value = "";
  $$(".chip").forEach((c) => c.classList.remove("on"));
  render();
});

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
buildPriceSelects();
Maps.init((id) => selectCard(id));

fetch("data/kos.json")
  .then((r) => r.json())
  .then((d) => {
    DATA = d;
    const p = new URLSearchParams(location.search);
    if (p.get("tipe")) {
      Filter.state.tipe = p.get("tipe");
      $("#tipeLabel").textContent = "Tipe: " + p.get("tipe");
      $("#tipeDD").classList.add("active");
    }
    if (p.get("fav")) {
      Filter.state.favOnly = true;
      $("#favChip").classList.add("on");
    }
    const q = p.get("q");
    q ? search(q) : render();
  })
  .catch(() => {
    $("#cards").innerHTML =
      '<p class="empty">Data gagal dimuat. Jalankan lewat Live Server.</p>';
  });
