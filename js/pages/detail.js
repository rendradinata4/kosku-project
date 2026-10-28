const $ = (s) => document.querySelector(s);
const id = new URLSearchParams(location.search).get("id");

const BM = {
  Dapur: "soup_kitchen",
  "Parkir motor": "two_wheeler",
  "Parkir mobil": "directions_car",
  "Mesin cuci": "local_laundry_service",
  Laundry: "local_laundry_service",
  "Ruang tamu": "chair",
  "Ruang santai": "weekend",
  "Ruang belajar": "menu_book",
  Jemuran: "dry_cleaning",
  "Kamar mandi luar": "bathtub",
};
const bIcon = (f) => BM[f] || "check_circle";

const facBox = (name, ic) =>
  `<div class="fbox"><div class="ic">${icon(ic)}</div><span>${name}</span></div>`;
const ruleLi = (t) =>
  `<li class="rule">${icon("task_alt")}<span>${t}</span></li>`;
const nb = (ic, t, d) =>
  `<div class="nb"><div class="ic">${icon(ic)}</div><div><span class="t">${t}</span><span class="d">${d}</span></div></div>`;

function updateFavUI(k) {
  const on = Fav.has(k.id);
  $("#favTop").classList.toggle("on", on);
  $("#favTop").innerHTML = icon("favorite");
  const band = $("#favBand");
  band.className = "favband " + (on ? "on" : "off");
  band.innerHTML = on
    ? icon("favorite") + "Tersimpan di Favorit"
    : icon("favorite_border") + "Simpan ke Favorit";
  $("#favCount").textContent = Fav.get().length;
}

fetch("data/kos.json")
  .then((r) => r.json())
  .then((data) => {
    const k = data.find((x) => x.id === id);
    $("#favCount").textContent = Fav.get().length;
    if (!k) {
      $("#app").innerHTML =
        '<p class="muted" style="padding:24px 0">Kos tidak ditemukan. <a href="index.html">Kembali ke beranda</a></p>';
      return;
    }
    document.title = k.nama + " – RuangNyaman";

    const imgs = [
      k.gambarUtama,
      ...["a", "b", "c"].map(
        (s) => `https://picsum.photos/seed/${k.id}${s}/800/500`,
      ),
    ];
    const dTugu = km(k, TUGU).toFixed(1);
    const semuaFasilitas = [
      ...k.fasilitas.map((f) => [f, AM[f] || "check_circle"]),
      ...k.bersama.map((f) => [f, bIcon(f)]),
    ];

    const desc =
      `${k.nama} adalah kos ${k.tipe.toLowerCase()} yang berlokasi di ${area(k)}, Surabaya, ${k.jarakTerdekat.toLowerCase()}. ` +
      `Saat ini tersedia ${k.sisaKamar} kamar, dilengkapi ${k.fasilitas.slice(0, 3).join(", ")}, serta fasilitas bersama seperti ${k.bersama.slice(0, 2).join(" dan ")}.`;

    $("#app").innerHTML = `
    <nav class="crumb">
      <a href="index.html">Beranda</a><span class="sep">/</span>
      <a href="cari.html">Surabaya</a><span class="sep">/</span>
      <a href="cari.html?q=${encodeURIComponent(area(k))}">${area(k)}</a><span class="sep">/</span>
      <span class="cur">${k.nama}</span>
    </nav>

    <section class="gal">
      <div class="gal-main" id="openGal0"><img src="${imgs[0]}" alt="${k.nama}"></div>
      <div class="gal-sub">
        <div class="thumb" id="openGal1"><img src="${imgs[1]}" alt=""></div>
        <div class="thumb" id="openGal2"><img src="${imgs[2]}" alt=""></div>
      </div>
    </section>

    <div class="layout"><div class="col">

      <div class="card">
        <div class="top-row">
          <div class="tags"><span class="tag tag-gender">${icon("group")} Kos ${k.tipe}</span></div>
          <div class="acts">
            <button class="iconbtn" id="shareBtn" aria-label="Bagikan tautan">${icon("share")}</button>
            <button class="iconbtn fav" id="favTop" aria-label="Simpan ke favorit"></button>
          </div>
        </div>
        <h1>${k.nama}</h1>
        <p class="addr">${icon("location_on")}<span>${k.alamat}</span></p>
        <div class="trust"><span class="ratebadge">${icon("star")} ${k.rating} <span style="font-weight:400">/ 5.0</span></span></div>
      </div>

      <div class="facts">
        <div class="fact"><div class="lbl">Tipe Kos</div><div class="val">${k.tipe}</div></div>
        <div class="fact"><div class="lbl">Sisa Kamar</div><div class="val" style="color:var(--p)">${k.sisaKamar} Kamar</div></div>
        <div class="fact"><div class="lbl">Rating</div><div class="val">${k.rating} / 5.0</div></div>
        <div class="fact"><div class="lbl">Jarak Terdekat</div><div class="val">${k.jarakTerdekat}</div></div>
      </div>

      <div class="card">
        <div class="chead"><div><h2>Fasilitas Hunian</h2><p class="sub">Fasilitas kamar dan fasilitas bersama</p></div>
          <span class="count-pill">${semuaFasilitas.length} Fasilitas</span></div>
        <div class="fgrid">${semuaFasilitas.map(([n, ic]) => facBox(n, ic)).join("")}</div>
      </div>

      <div class="card">
        <h2 style="margin-bottom:12px">Deskripsi Kos</h2>
        <div class="desc"><p>${desc}</p>
          <div class="hl">${icon("near_me")}<p>Berjarak ${k.jarakTerdekat.toLowerCase()}, serta sekitar ${dTugu} km dari Tugu Pahlawan (pusat Kota Surabaya).</p></div>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-bottom:12px">Tata Tertib &amp; Peraturan Kos</h2>
        <ul class="rules">${k.aturan.map(ruleLi).join("")}</ul>
      </div>

      <div class="card">
        <div class="chead"><div><h2>Lokasi</h2><p class="sub">${k.alamat}</p></div>
          <a class="maplink" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${k.lat},${k.lng}">Buka di Google Maps ${icon("open_in_new")}</a></div>
        <div id="dmap"></div>
        <div class="nearby">${nb("school", "Lokasi kos", k.jarakTerdekat)}${nb("location_city", "Tugu Pahlawan", dTugu + " km")}</div>
      </div>

      <div class="card">
        <h2>Rating Kos</h2>
        <div class="score"><span class="num">${k.rating}</span>
          <div class="stars">${icon("star")}${icon("star")}${icon("star")}${icon("star")}${icon("star")}</div>
          <span class="muted" style="font-size:.75rem">Rating keseluruhan dari data kos</span></div>
      </div>

    </div>

    <aside><div class="book">
      <button class="favband" id="favBand"></button>
      <div class="pricebox">
        <span class="pcap">Mulai Dari</span>
        <div class="pflex"><span class="pval" id="priceVal">${rp(k.hargaBulanan)}</span><span class="psub" id="priceUnit">/ bulan</span></div>
        <p class="pnote">${icon("check_circle")}Belum termasuk deposit</p>
      </div>
      <div>
        <label class="pcap" style="display:block;margin-bottom:6px">Pilih Rincian Harga</label>
        <div class="tabs" id="tabs">
          <button class="tab active" data-p="${k.hargaBulanan}" data-u="/ bulan">Bulanan<br><small>${rp(k.hargaBulanan)}</small></button>
          <button class="tab" data-p="${k.hargaBulanan * 11}" data-u="/ tahun (hemat 1 bln)">Tahunan<br><small>${rp(k.hargaBulanan * 11)}</small></button>
        </div>
      </div>
      <div class="roombox">${icon("door_front")}<div><b>Sisa ${k.sisaKamar} Kamar Tersedia</b><small>Segera hubungi pengelola untuk survei lokasi</small></div></div>
      <div class="pricelist"><span>Deposit: <b>${rp(k.hargaBulanan / 2)}</b></span><span>Listrik &amp; air: <b>Sesuai pemakaian</b></span></div>
      <a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(k)}">${icon("chat")}Hubungi via WhatsApp</a>
      <a class="btn btn-out" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${k.lat},${k.lng}">${icon("map")}Buka di Google Maps</a>
    </div></aside>
    </div>`;

    // Galeri (lightbox sederhana)
    $("#dlgImgs").innerHTML = imgs
      .map(
        (s) => `<img src="${s}" alt="" style="width:100%;border-radius:10px">`,
      )
      .join("");
    ["openGal0", "openGal1", "openGal2"].forEach((gid) =>
      $("#" + gid).addEventListener("click", () => $("#dlg").showModal()),
    );
    $("#dlgClose").addEventListener("click", () => $("#dlg").close());

    // Favorit (pita status di atas kartu, sinkron dengan tombol hati di judul)
    updateFavUI(k);
    const toggleFav = () => {
      Fav.toggle(k.id);
      updateFavUI(k);
    };
    $("#favTop").addEventListener("click", toggleFav);
    $("#favBand").addEventListener("click", toggleFav);

    // Bagikan tautan
    $("#shareBtn").addEventListener("click", () => {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(location.href);
      const b = $("#shareBtn");
      b.innerHTML = icon("check");
      setTimeout(() => (b.innerHTML = icon("share")), 1500);
    });

    // Tab harga
    $("#tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".tab");
      if (!b) return;
      document
        .querySelectorAll("#tabs .tab")
        .forEach((t) => t.classList.remove("active"));
      b.classList.add("active");
      $("#priceVal").textContent = rp(+b.dataset.p);
      $("#priceUnit").textContent = b.dataset.u;
    });

    // Peta lokasi
    // Di HP, peta tidak boleh "menangkap" geseran jari, kalau tidak halaman
    // jadi tidak bisa di-scroll saat jari mendarat di atas peta.
    const map = L.map("dmap", {
      dragging: !L.Browser.mobile, // geser peta dengan 1 jari: hanya di desktop
      tap: !L.Browser.mobile, // fitur tap bawaan Leaflet untuk perangkat sentuh lama
    }).setView([k.lat, k.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; kontributor OpenStreetMap",
    }).addTo(map);
    L.marker([k.lat, k.lng]).addTo(map).bindPopup(k.nama).openPopup();
  })
  .catch(() => {
    $("#app").innerHTML =
      '<p class="muted" style="padding:24px 0">Data gagal dimuat. Jalankan lewat Live Server.</p>';
  });
