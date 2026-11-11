const $ = (s) => document.querySelector(s);

// Halaman Favorit hanya untuk yang sudah login; jika belum, diarahkan ke halaman masuk
Auth.require(["pencari", "pemilik", "admin"]);
let DATA = [];
let activeTipe = "";

const GENDER_ICON = { Putri: "female", Putra: "male", Campur: "groups" };

function favorited() {
  const ids = Fav.get();
  return DATA.filter((k) => ids.includes(k.id));
}

function counts(list) {
  return {
    all: list.length,
    Putri: list.filter((k) => k.tipe === "Putri").length,
    Putra: list.filter((k) => k.tipe === "Putra").length,
    Campur: list.filter((k) => k.tipe === "Campur").length,
  };
}

function renderTabs(list) {
  const c = counts(list);
  const tabs = [
    ["", "Semua", c.all],
    ["Putri", "Putri", c.Putri],
    ["Putra", "Putra", c.Putra],
    ["Campur", "Campur", c.Campur],
  ];
  $("#ftabs").innerHTML = tabs
    .map(
      ([v, label, n]) =>
        `<button class="ftab ${activeTipe === v ? "active" : ""}" data-v="${v}">${label} (${n})</button>`,
    )
    .join("");
}

function card(k) {
  const low = k.sisaKamar <= 2;
  return `<article class="card" data-id="${k.id}">
    <div class="thumb"><img src="${k.gambarUtama}" alt="${k.nama}" loading="lazy">
      <div class="corner">
        <span class="typebadge t-${k.tipe}">${icon(GENDER_ICON[k.tipe])} ${k.tipe}</span>
        <span class="ratebadge">${icon("star")} ${k.rating}</span>
      </div>
      <button class="rmfav" data-id="${k.id}" data-name="${k.nama}" title="Hapus dari favorit" aria-label="Hapus dari favorit">${icon("favorite")}</button>
      <span class="roompill">${low ? "Sisa" : "Tersedia"} ${k.sisaKamar} Kamar</span>
    </div>
    <div class="body">
      <div>
        <div class="locrow">${icon("location_on")}<span>${area(k)}, Surabaya · ${k.jarakTerdekat}</span></div>
        <h2 class="ctitle" title="${k.nama}">${k.nama}</h2>
        <div class="frow">${k.fasilitas
          .slice(0, 4)
          .map((f) =>
            AM[f] ? `<span class="ftag">${icon(AM[f])} ${f}</span>` : "",
          )
          .join("")}</div>
      </div>
      <div class="pact">
        <div class="prow"><span class="pval">${rp(k.hargaBulanan)}</span> <span class="punit">/ bulan</span></div>
        <div style="display:flex;gap:6px">
          <a class="btn-wa-mini" href="${waLink(k)}" target="_blank" rel="noopener" aria-label="Hubungi via WhatsApp">${icon("chat")}</a>
          <a class="btn-detail" href="detail.html?id=${k.id}"><span>Lihat Detail</span>${icon("arrow_forward")}</a>
        </div>
      </div>
    </div></article>`;
}

function render() {
  const all = favorited();
  const list = activeTipe ? all.filter((k) => k.tipe === activeTipe) : all;
  renderTabs(all);
  $("#countText").textContent = all.length + " Kos Tersimpan";
  $("#favCount").textContent = all.length;
  $("#grid").innerHTML = list.map(card).join("");
  $("#grid").style.display = all.length ? "grid" : "none";
  $("#empty").classList.toggle("show", all.length === 0);
}

function showToast(msg) {
  $("#toastMsg").textContent = msg;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2500);
}

$("#ftabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-v]");
  if (!b) return;
  activeTipe = b.dataset.v;
  render();
});

$("#grid").addEventListener("click", (e) => {
  const b = e.target.closest(".rmfav");
  if (!b) return;
  const card = b.closest(".card");
  card.style.transition = "all .3s ease-out";
  card.style.opacity = "0";
  card.style.transform = "scale(.95)";
  Fav.toggle(b.dataset.id);
  showToast(`"${b.dataset.name}" dihapus dari favorit.`);
  setTimeout(render, 260);
});

getAllKos()
  .then((d) => {
    DATA = d;
    render();
  })
  .catch(() => {
    $("#grid").innerHTML = "";
    $("#empty").classList.add("show");
    $("#empty .etitle").textContent = "Data gagal dimuat";
    $("#empty .edesc").textContent = "Jalankan lewat Live Server.";
  });