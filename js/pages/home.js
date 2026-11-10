const $ = (s) => document.querySelector(s);

const card = (k) => `<article class="card" data-id="${k.id}">
  <div class="thumb"><img src="${k.gambarUtama}" alt="${k.nama}" loading="lazy">
    <span class="gender g-${k.tipe}">${icon(GI[k.tipe])} ${k.tipe}</span>
    <button class="heart ${Fav.has(k.id) ? "on" : ""}" aria-label="Simpan ke favorit">${icon("favorite")}</button>
    <span class="rating">${icon("star")} ${k.rating}</span></div>
  <div class="cbody">
    <div><div class="dist">${icon("distance")} ${k.jarakTerdekat}</div>
      <a class="ctitle" href="detail.html?id=${k.id}">${k.nama}</a><p class="loc">${area(k)}, Surabaya</p></div>
    <div class="am">${k.fasilitas.map((f) => (AM[f] ? `<span title="${f}">${icon(AM[f])}</span>` : "")).join("")}</div>
    <div class="cfoot"><div><small>Mulai dari</small><span class="price">${rp(k.hargaBulanan)}<small> /bln</small></span></div>
      <span class="room ${k.sisaKamar <= 2 ? "low" : ""}">${k.sisaKamar <= 2 ? "Sisa" : "Tersedia"} ${k.sisaKamar} Kamar</span></div>
  </div></article>`;

const metric = (c, ic, num, label) =>
  `<div class="metric"><div class="mi ${c}">${icon(ic)}</div><div><strong>${num}</strong><small>${label}</small></div></div>`;
const updateCount = () => {
  $("#favCount").textContent = Fav.get().length;
};
updateCount();

// Klik hati = simpan/hapus favorit; klik bagian lain kartu = buka detail di tab yang sama
$("#grid").addEventListener("click", (e) => {
  const c = e.target.closest(".card");
  if (!c) return;
  const h = e.target.closest(".heart");
  if (h) {
    h.classList.toggle("on", Fav.toggle(c.dataset.id));
    updateCount();
    return;
  }
  location.href = "detail.html?id=" + c.dataset.id;
});

getAllKos()
  .then((data) => {
    const avg = data.reduce((s, k) => s + k.rating, 0) / data.length;
    const rooms = data.reduce((s, k) => s + k.sisaKamar, 0);
    const min = Math.min(...data.map((k) => k.hargaBulanan));
    $("#metrics").innerHTML =
      metric("", "apartment", data.length + " Kos", "Terdata di Surabaya") +
      metric("b", "bed", rooms + " Kamar", "Masih Tersedia") +
      metric("c", "reviews", avg.toFixed(1) + " / 5.0", "Rating Rata-rata") +
      metric("d", "payments", rp(min), "Harga Mulai per Bulan");

    $("#grid").innerHTML = [...data]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8)
      .map(card)
      .join("");
    $("#all").innerHTML =
      `Lihat Semua (${data.length}) ${icon("arrow_forward")}`;
    $("#count").textContent = data.length + " kos di peta";

    const map = L.map("mini", {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    data.forEach((k) =>
      L.circleMarker([k.lat, k.lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#00A86B",
        fillOpacity: 1,
      }).addTo(map),
    );
    map.fitBounds(
      data.map((k) => [k.lat, k.lng]),
      { padding: [30, 30] },
    );
  })
  .catch(() => {
    $("#grid").innerHTML =
      "<p>Data gagal dimuat. Jalankan lewat Live Server.</p>";
  });
