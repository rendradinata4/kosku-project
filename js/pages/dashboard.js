const $ = (s) => document.querySelector(s);

const STATUS = {
  draft: {
    label: "Draft",
    kelas: "st-draft",
    info: "Belum diajukan. Lengkapi data lalu ajukan ke admin.",
  },
  menunggu: {
    label: "Menunggu persetujuan",
    kelas: "st-menunggu",
    info: "Sedang diperiksa admin.",
  },
  menunggu_pembayaran: {
    label: "Menunggu pembayaran",
    kelas: "st-bayar",
    info: "Disetujui admin. Bayar biaya publikasi agar kos tampil di pencarian.",
  },
  aktif: {
    label: "Tayang",
    kelas: "st-aktif",
    info: "Sudah tampil di pencarian.",
  },
  ditolak: {
    label: "Ditolak",
    kelas: "st-ditolak",
    info: "Perbaiki sesuai alasan di bawah, lalu ajukan lagi.",
  },
};

const PESAN = {
  disimpan: "Kos berhasil disimpan.",
  diajukan: "Kos diajukan. Admin akan memeriksanya sebelum tayang.",
  "perlu-persetujuan":
    "Perubahan data utama kos yang sudah tayang membutuhkan persetujuan ulang admin, jadi kos ini kembali ke status menunggu.",
};

let profil;
let daftar = [];
let bayarSaya = []; // pembayaran lunas milik pemilik ini (untuk menampilkan masa tayang)
let transaksiSaya = []; // semua transaksi milik pemilik ini (riwayat dan grafik biaya)
let tab = "home"; // tab yang sedang dibuka: "home" atau "kos"

// Tanggal tayang terakhir sebuah kos berdasarkan pembayaran lunas (null jika belum ada)
function tayangSampai(kosId) {
  const t = bayarSaya.filter((b) => String(b.kos_id) === String(kosId)).map((b) => new Date(b.aktif_sampai).getTime());
  return t.length ? new Date(Math.max(...t)).toISOString() : null;
}

function notif(teks, jenis = "ok") {
  const el = $("#notif");
  el.textContent = teks;
  el.className = "dash-notif " + jenis;
  el.hidden = !teks;
}

const urut = (a) => [...a].sort((x, y) => x.urutan - y.urutan);

function kartu(k) {
  const st = STATUS[k.status];
  // Untuk kos tayang: cek apakah masa tayangnya sudah habis atau hampir habis
  const masa = k.status === "aktif" ? Pembayaran.masa(tayangSampai(k.id)) : null;
  const habis = !!masa && masa.status === "habis";
  const tersedia = k.kamar.filter((x) => x.status === "tersedia").length;
  const mulai = k.kamar.length
    ? rp(Math.min(...k.kamar.map((x) => x.harga)))
    : "belum ada kamar";
  const foto = urut(k.kos_gambar)[0];
  const thumb = foto
    ? `<img src="${esc(Owner.urlFoto(foto.path))}" alt="" loading="lazy">`
    : icon("apartment");

  const aksi = [
    `<a class="dash-btn ghost" href="form-kos.html?id=${k.id}">Ubah</a>`,
  ];
  if (k.status === "draft" || k.status === "ditolak")
    aksi.push(
      `<button type="button" class="dash-btn" data-aksi="ajukan" data-id="${k.id}">Ajukan</button>`,
    );
  if (k.status === "menunggu")
    aksi.push(
      `<button type="button" class="dash-btn ghost" data-aksi="tarik" data-id="${k.id}">Tarik pengajuan</button>`,
    );
  if (k.status === "menunggu_pembayaran") {
    aksi.push(
      `<button type="button" class="dash-btn" data-aksi="bayar" data-id="${k.id}">Bayar &amp; tayangkan</button>`,
    );
    aksi.push(
      `<button type="button" class="dash-btn ghost" data-aksi="tarik" data-id="${k.id}">Batalkan</button>`,
    );
  }
  if (k.status === "aktif") {
    aksi.push(
      `<button type="button" class="dash-btn" data-aksi="bayar" data-id="${k.id}">Perpanjang</button>`,
    );
    if (!habis)
      aksi.push(
        `<a class="dash-btn ghost" href="detail.html?id=${k.id}">Lihat di situs</a>`,
      );
    aksi.push(
      `<button type="button" class="dash-btn ghost" data-aksi="tarik" data-id="${k.id}">Turunkan dari situs</button>`,
    );
  }
  aksi.push(
    `<button type="button" class="dash-btn danger" data-aksi="hapus" data-id="${k.id}">Hapus</button>`,
  );

  const sampai = k.status === "aktif" ? tayangSampai(k.id) : null;
  let info = st.info;
  if (habis) info = `Masa tayang berakhir pada ${Pembayaran.tanggal(sampai)}. Kos ini tidak tampil di pencarian. Perpanjang agar tayang lagi.`;
  else if (sampai) info = `${st.info} Tayang sampai ${Pembayaran.tanggal(sampai)} (${masa.label}).`;
  const lencana = habis ? { label: "Masa tayang habis", kelas: "st-habis" } : st;

  return `<article class="dash-card">
    <div class="dash-thumb">${thumb}</div>
    <div class="dash-info">
      <div class="dash-row"><h2>${esc(k.nama)}</h2><span class="dash-badge ${lencana.kelas}">${lencana.label}</span></div>
      <p class="dash-meta">${esc(k.tipe)} · ${esc(k.alamat)}</p>
      <p class="dash-meta">${tersedia} dari ${k.kamar.length} kamar tersedia · mulai ${mulai}</p>
      <p class="${habis ? "dash-alasan" : "dash-hint"}">${info}</p>
      ${k.status === "ditolak" ? `<p class="dash-alasan"><b>Alasan penolakan:</b> ${esc(k.alasan_penolakan || "-")}</p>` : ""}
      <div class="dash-actions">${aksi.join("")}</div>
    </div>
  </article>`;
}

function ringkasan() {
  const hitung = (s) => daftar.filter((k) => k.status === s).length;
  // Isi angka pada kartu statistik
  document.querySelectorAll(".stat-n").forEach((e) => e.classList.remove("sk")); // hilangkan skeleton angka
  $("#sTotal").textContent = daftar.length;
  // "Tayang" hanya menghitung kos aktif yang masa tayangnya belum habis
  $("#sAktif").textContent = daftar.filter((k) => k.status === "aktif" && Pembayaran.masa(tayangSampai(k.id)).status !== "habis").length;
  $("#sMenunggu").textContent = hitung("menunggu") + hitung("menunggu_pembayaran");
  $("#sLain").textContent = hitung("draft") + hitung("ditolak");
  // Lencana jumlah kos yang perlu perpanjangan pada menu "Kos Saya"
  const perlu = daftar.filter((k) => k.status === "aktif" && Pembayaran.masa(tayangSampai(k.id)).status !== "aman").length;
  $("#cPerlu").textContent = perlu;
  $("#cPerlu").hidden = !perlu;
}

async function muat() {
  daftar = await Owner.daftarKos(profil.id);
  bayarSaya = await Pembayaran.milikSaya(profil.id).catch(() => []); // gagal = anggap belum ada
  transaksiSaya = await Pembayaran.semua().catch(() => []);
  ringkasan();
  aturTab();
  panelHome();
  $("#daftar").innerHTML = daftar.length
    ? daftar.map(kartu).join("")
    : '<p class="dash-empty">Belum ada kos. Klik <b>+ Tambah Kos</b> untuk memulai.</p>';
}

// ---------- Home pemilik ----------
const WARNA_STATUS = { tayang: "#00a86b", habis: "#b42318", menunggu: "#f2b01e", menunggu_pembayaran: "#4f8ef7", draft: "#9aa7b5", ditolak: "#e5484d" };
const hitungPer = (d, kunci) => d.reduce((h, x) => { const k = kunci(x); h[k] = (h[k] || 0) + 1; return h; }, {});

// Gabungan data masa tayang satu kos: tanggal berakhir + keadaan (habis/segera/aman) + sisa hari
const infoMasa = (k) => { const sampai = tayangSampai(k.id); return { sampai, ...Pembayaran.masa(sampai) }; };

// Lama paket terakhir yang dibayar untuk kos ini (bulan), dipakai menghitung panjang bar sisa waktu
function bulanTerakhir(kosId) {
  const t = transaksiSaya
    .filter((x) => String(x.kos_id) === String(kosId) && x.status === "lunas")
    .sort((a, b) => new Date(b.aktif_sampai) - new Date(a.aktif_sampai))[0];
  return t ? t.bulan : 1;
}

// Biaya publikasi yang dibayar per bulan (n bulan terakhir)
function dataBiaya(n) {
  const lunas = transaksiSaya.filter((t) => t.status === "lunas" && t.dibayar_pada);
  const sekarang = new Date();
  const hasil = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 1);
    const nilai = lunas
      .filter((t) => { const x = new Date(t.dibayar_pada); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); })
      .reduce((s, t) => s + t.nominal, 0);
    hasil.push({ label: d.toLocaleDateString("id-ID", { month: "short" }), judul: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), nilai });
  }
  return hasil;
}

const kepalaKartu = (judul, sub, tujuan) => `<div class="hm-kepala"><div><h2>${judul}</h2><p>${sub}</p></div>
  ${tujuan ? `<button type="button" class="hm-ikon" data-aksi="ke-tab" data-id="${tujuan}" aria-label="Buka daftar kos"><span class="material-symbols-outlined">arrow_outward</span></button>` : ""}</div>`;

function panelHome() {
  if (!daftar.length) {
    $("#panelHome").innerHTML = `<div class="hm-kartu"><p class="hm-kosong">Anda belum memasang kos. Tambahkan kos pertama Anda untuk mulai tayang di RuangNyaman.</p>
      <p style="margin-top:12px"><a class="dash-btn" href="form-kos.html">+ Tambah Kos</a></p></div>`;
    return;
  }

  const aktif = daftar.filter((k) => k.status === "aktif").map((k) => ({ k, m: infoMasa(k) }));
  const habis = aktif.filter((x) => x.m.status === "habis");
  const segera = aktif.filter((x) => x.m.status === "segera");
  const tayang = aktif.length - habis.length;
  const jml = (s) => daftar.filter((k) => k.status === s).length;
  const lunas = transaksiSaya.filter((t) => t.status === "lunas");
  const totalBiaya = lunas.reduce((s, t) => s + t.nominal, 0);

  // 1) Peringatan: merah untuk masa tayang habis, kuning untuk sisa <= 7 hari
  const tombolPerpanjang = (id, teks, merah) => `<button type="button" class="dash-btn${merah ? "" : " ghost"}" data-aksi="bayar" data-id="${id}">${teks}</button>`;
  const peringatan =
    habis.map(({ k, m }) => `<div class="hm-alert merah" role="alert"><span class="material-symbols-outlined">error</span>
      <div><b>Masa tayang "${esc(k.nama)}" sudah habis</b>
      <p>${esc(m.label)}. Kos ini tidak lagi tampil di pencarian, sehingga calon penghuni tidak bisa menemukannya. Perpanjang sekarang agar tayang kembali.</p></div>
      ${tombolPerpanjang(k.id, "Perpanjang sekarang", true)}</div>`).join("") +
    segera.map(({ k, m }) => `<div class="hm-alert kuning" role="status"><span class="material-symbols-outlined">schedule</span>
      <div><b>Masa tayang "${esc(k.nama)}" tinggal ${esc(m.label.replace(" lagi", ""))}</b>
      <p>Berakhir pada ${Pembayaran.tanggal(m.sampai)}. Perpanjang sebelum habis agar kos tidak hilang dari pencarian.</p></div>
      ${tombolPerpanjang(k.id, "Perpanjang", false)}</div>`).join("");

  // 2) Daftar masa tayang (yang paling mendesak di atas)
  const urutMasa = [...aktif].sort((a, b) => a.m.hari - b.m.hari);
  const barisMasa = urutMasa.map(({ k, m }) => {
    const total = Math.max(bulanTerakhir(k.id) * 30, m.hari, 1);
    const persen = m.status === "habis" ? 100 : Math.max(4, Math.min(100, (m.hari / total) * 100));
    return `<li class="hm-masa ${m.status}">
      <div class="hm-masa-atas"><b>${esc(k.nama)}</b><span class="hm-sisa ${m.status}">${esc(m.label)}</span></div>
      <div class="gf-trek"><div class="gf-isi ${m.status}" style="width:${persen}%"></div></div>
      <div class="hm-masa-bawah"><small>${m.sampai ? "Tayang sampai " + Pembayaran.tanggal(m.sampai) : "Belum ada pembayaran"}</small>
        ${tombolPerpanjang(k.id, "Perpanjang", m.status === "habis")}</div></li>`;
  }).join("");

  // 3) Diagram status kos (kos tayang dipisah dari yang masa tayangnya habis)
  const bagianStatus = [
    { label: "Tayang", nilai: tayang, warna: WARNA_STATUS.tayang },
    { label: "Masa tayang habis", nilai: habis.length, warna: WARNA_STATUS.habis },
    { label: "Menunggu persetujuan", nilai: jml("menunggu"), warna: WARNA_STATUS.menunggu },
    { label: "Menunggu pembayaran", nilai: jml("menunggu_pembayaran"), warna: WARNA_STATUS.menunggu_pembayaran },
    { label: "Draft", nilai: jml("draft"), warna: WARNA_STATUS.draft },
    { label: "Ditolak", nilai: jml("ditolak"), warna: WARNA_STATUS.ditolak },
  ];

  // 4) Riwayat pembayaran terbaru
  const riwayat = transaksiSaya.slice(0, 5).map((t) => {
    const kedaluwarsa = t.status === "pending" && new Date(t.kedaluwarsa_pada) < new Date();
    const st = kedaluwarsa ? "kedaluwarsa" : t.status;
    const kelas = { lunas: "st-aktif", pending: "st-menunggu", kedaluwarsa: "st-draft" }[st] || "st-draft";
    const label = { lunas: "Lunas", pending: "Menunggu", kedaluwarsa: "Kedaluwarsa" }[st] || st;
    return `<tr><td><b>${esc(t.nama_kos)}</b></td><td>${Pembayaran.tanggal(t.dibayar_pada || t.dibuat_pada)}</td><td>${t.bulan} bln</td>
      <td><span class="dash-badge ${kelas}">${label}</span></td><td><b>${rp(t.nominal)}</b></td></tr>`;
  }).join("");

  // 5) Okupansi kamar pada kos yang sudah tayang + ketersediaan per kos
  const kosTayang = daftar.filter((k) => k.status === "aktif");
  const kamar = kosTayang.flatMap((k) => k.kamar);
  const terisi = kamar.filter((m) => m.status === "terisi").length;
  const persen = kamar.length ? Math.round((terisi / kamar.length) * 100) : 0;
  const perKos = kosTayang.filter((k) => k.kamar.length).map((k) => {
    const ada = k.kamar.filter((m) => m.status === "tersedia").length;
    return { label: k.nama, nilai: ada, teks: `${ada} / ${k.kamar.length} kamar kosong` };
  });

  // 6) Daftar hal yang perlu ditindaklanjuti
  const todo = [];
  habis.forEach(({ k }) => todo.push({ ikon: "error", merah: true, judul: k.nama, isi: "Masa tayang habis, kos tidak tampil di pencarian.", tombol: tombolPerpanjang(k.id, "Perpanjang", true) }));
  segera.forEach(({ k, m }) => todo.push({ ikon: "schedule", judul: k.nama, isi: `Masa tayang tinggal ${m.label.replace(" lagi", "")}.`, tombol: tombolPerpanjang(k.id, "Perpanjang", false) }));
  daftar.filter((k) => k.status === "menunggu_pembayaran").forEach((k) => todo.push({ ikon: "payments", judul: k.nama, isi: "Disetujui admin. Bayar agar kos tampil.", tombol: tombolPerpanjang(k.id, "Bayar", true) }));
  daftar.filter((k) => k.status === "ditolak").forEach((k) => todo.push({ ikon: "edit_note", judul: k.nama, isi: "Ditolak: " + (k.alasan_penolakan || "-"), tombol: `<a class="dash-btn ghost" href="form-kos.html?id=${k.id}">Perbaiki</a>` }));
  daftar.filter((k) => k.status === "draft").forEach((k) => todo.push({ ikon: "edit_note", judul: k.nama, isi: "Masih draft. Lengkapi lalu ajukan.", tombol: `<a class="dash-btn ghost" href="form-kos.html?id=${k.id}">Lengkapi</a>` }));
  daftar.filter((k) => k.status === "menunggu").forEach((k) => todo.push({ ikon: "hourglass_top", judul: k.nama, isi: "Sedang diperiksa admin.", tombol: "" }));

  $("#panelHome").innerHTML = `${peringatan ? `<div class="hm-alerts">${peringatan}</div>` : ""}
    <div class="hm-grid hm-g1">
      <div class="hm-kol">
        <div class="hm-kartu hm-hero">
          ${kepalaKartu("Kos tayang", "Tampil di pencarian saat ini")}
          <p class="hm-besar">${tayang} <span style="font-size:1rem;font-weight:600;opacity:.85">dari ${daftar.length} kos</span></p>
          <div class="hm-dua"><div><span>Perlu perpanjang</span><b>${habis.length + segera.length}</b></div><div><span>Menunggu proses</span><b>${jml("menunggu") + jml("menunggu_pembayaran")}</b></div></div>
        </div>
        <div class="hm-kartu hm-mini">
          <p class="hm-lbl">Biaya publikasi dibayar</p>
          <p class="hm-nilai"><span>${rp(totalBiaya)}</span></p>
          <p class="hm-lbl" style="margin-top:8px">${lunas.length} pembayaran lunas</p>
        </div>
      </div>

      <div class="hm-kartu">
        ${kepalaKartu("Masa tayang kos", "Sisa waktu tayang tiap kos")}
        ${barisMasa ? `<ul class="hm-masa-list">${barisMasa}</ul>` : '<p class="hm-kosong">Belum ada kos yang tayang.</p>'}
      </div>

      <div class="hm-kartu">
        ${kepalaKartu("Status kos", "Semua kos Anda", "kos")}
        ${Grafik.donat(bagianStatus, { angka: daftar.length, teks: "kos" })}
      </div>
    </div>

    <div class="hm-grid hm-g2">
      <div class="hm-kartu">
        ${kepalaKartu("Riwayat pembayaran", "Lima transaksi terakhir")}
        ${transaksiSaya.length
          ? `<div class="hm-tabel-scroll"><table class="hm-tabel"><thead><tr><th>Kos</th><th>Tanggal</th><th>Paket</th><th>Status</th><th>Nominal</th></tr></thead><tbody>${riwayat}</tbody></table></div>`
          : '<p class="hm-kosong">Belum ada pembayaran.</p>'}
      </div>
      <div class="hm-kartu">
        ${kepalaKartu("Biaya publikasi", "Dibayar per bulan")}
        ${Grafik.batang(dataBiaya(6), Grafik.singkat)}
      </div>
    </div>

    <div class="hm-grid hm-g3">
      <div class="hm-kartu">
        ${kepalaKartu("Okupansi kamar", "Pada kos yang tayang")}
        ${Grafik.donat([
          { label: "Terisi", nilai: terisi, warna: "#006d43" },
          { label: "Kosong", nilai: kamar.length - terisi, warna: "#c4ead6" },
        ], { angka: persen + "%", teks: "terisi" })}
      </div>
      <div class="hm-kartu">
        ${kepalaKartu("Kamar kosong per kos", "Kos yang tayang")}
        ${Grafik.baris(perKos, "Belum ada kos tayang dengan kamar.")}
      </div>
      <div class="hm-kartu">
        ${kepalaKartu("Perlu tindakan", todo.length ? `${todo.length} hal` : "Semua beres")}
        ${todo.length
          ? `<ul class="hm-todo">${todo.map((t) => `<li class="${t.merah ? "merah" : ""}"><span class="material-symbols-outlined">${t.ikon}</span>
              <div><b>${esc(t.judul)}</b><small>${esc(t.isi)}</small></div>${t.tombol}</li>`).join("")}</ul>`
          : '<p class="hm-kosong">Semua kos Anda dalam kondisi baik.</p>'}
      </div>
    </div>`;
}

// Menyesuaikan judul, kartu statistik, dan panel sesuai tab yang dibuka
function aturTab() {
  document.querySelectorAll(".own-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const home = tab === "home";
  $("#judulHalaman").textContent = home ? "Selamat datang, " + (profil.nama || "Pemilik") : "Kos Saya";
  $("#ringkasan").textContent = home
    ? "Pantau masa tayang, pembayaran, dan kondisi kos Anda."
    : daftar.length ? "Kelola semua kos Anda di sini." : "Anda belum memasang kos.";
  $("#barStat").hidden = home;
  $("#panelHome").hidden = !home;
  $("#kotakKos").hidden = home;
}

async function jalankan(aksi, id) {
  const k = daftar.find((x) => String(x.id) === String(id));
  if (!k) return;
  try {
    if (aksi === "ajukan") {
      if (k.kamar.length < 1)
        return notif(
          "Tambahkan minimal satu kamar lewat menu Ubah sebelum mengajukan.",
          "error",
        );
      if (k.kos_gambar.length < 1)
        return notif(
          "Unggah minimal satu foto lewat menu Ubah sebelum mengajukan.",
          "error",
        );
      if (!/^62\d{8,12}$/.test(k.no_whatsapp || ""))
        return notif(
          "Isi nomor WhatsApp yang benar lewat menu Ubah sebelum mengajukan.",
          "error",
        );
      await Owner.ubahStatus(id, "menunggu");
      notif(PESAN.diajukan, "ok");
    } else if (aksi === "tarik") {
      const pesan =
        k.status === "aktif"
          ? "Turunkan kos ini dari situs? Untuk tayang lagi, kos harus diajukan dan disetujui ulang."
          : "Tarik pengajuan kos ini?";
      if (!confirm(pesan)) return;
      await Owner.ubahStatus(id, "draft");
      notif("Kos dikembalikan ke draft.", "ok");
    } else if (aksi === "bayar") {
      bukaBayar(k);
      return;
    } else if (aksi === "hapus") {
      if (
        !confirm(
          `Hapus kos "${k.nama}" beserta semua kamarnya? Tindakan ini tidak bisa dibatalkan.`,
        )
      )
        return;
      await Owner.hapus(id);
      notif("Kos dihapus.", "ok");
    }
    await muat();
  } catch (err) {
    notif("Gagal: " + ((err && err.message) || "coba lagi."), "error");
  }
}

// ---------- Pembayaran: pilih paket -> QR -> menunggu dipindai ----------
let bayarKos = null; // kos yang sedang dibayar
let paketDipilih = 3; // paket awal: 3 bulan
let kodeAktif = null; // kode transaksi yang sedang dipantau
let pantau; // interval pemantau status
let hitung; // interval hitung mundur

const dlgBayar = $("#dlgBayar");
const tampilBayar = (bagian) => {
  ["bayarPilih", "bayarQr", "bayarOk"].forEach((id) => ($("#" + id).hidden = id !== bagian));
  $("#errBayar").hidden = true;
};
function hentikanPantau() {
  clearInterval(pantau);
  clearInterval(hitung);
  kodeAktif = null;
}
function tutupBayar() {
  hentikanPantau();
  dlgBayar.close();
}

function bukaBayar(k) {
  bayarKos = k;
  $("#judulBayar").textContent = (k.status === "aktif" ? "Perpanjang: " : "Bayar publikasi: ") + k.nama;
  $("#paketList").innerHTML = Pembayaran.PAKET.map(
    (p) => `<label class="paket ${p.bulan === paketDipilih ? "on" : ""}">
      <input type="radio" name="paket" value="${p.bulan}" ${p.bulan === paketDipilih ? "checked" : ""}>
      <span><b>${p.label}</b>${p.hemat ? `<small class="paket-hemat">${p.hemat}</small>` : ""}</span>
      <strong>${rp(p.harga)}</strong></label>`,
  ).join("");
  tampilBayar("bayarPilih");
  dlgBayar.showModal();
}

$("#paketList").addEventListener("change", (e) => {
  paketDipilih = Number(e.target.value);
  document.querySelectorAll(".paket").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
});

$("#btnBuatQr").addEventListener("click", async () => {
  const tombol = $("#btnBuatQr");
  tombol.disabled = true;
  try {
    const t = await Pembayaran.buat(bayarKos.id, paketDipilih);
    kodeAktif = t.kode;
    const url = Pembayaran.urlBayar(t.kode);
    $("#qrKode").innerHTML = "";
    new QRCode($("#qrKode"), { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    $("#qrNominal").textContent = rp(t.nominal);
    $("#linkBayar").href = url;
    $("#qrLokal").hidden = !/^(localhost|127\.|\[::1\])/.test(location.hostname);
    tampilBayar("bayarQr");
    mulaiPantau(t);
  } catch (err) {
    $("#errBayar").hidden = false;
    $("#errBayar").textContent = "Gagal membuat QR: " + ((err && err.message) || "coba lagi.");
  } finally {
    tombol.disabled = false;
  }
});

// Cek status transaksi tiap 2 detik; jika lunas, tampilkan hasil dan muat ulang daftar kos
function mulaiPantau(t) {
  const batas = new Date(t.kedaluwarsa_pada).getTime();
  const tik = () => {
    const s = Math.max(0, Math.round((batas - Date.now()) / 1000));
    $("#qrSisa").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    if (s === 0) {
      hentikanPantau();
      tampilBayar("bayarPilih");
      $("#errBayar").hidden = false;
      $("#errBayar").textContent = "QR kedaluwarsa. Pilih paket dan buat QR baru.";
    }
  };
  tik();
  hitung = setInterval(tik, 1000);
  pantau = setInterval(async () => {
    try {
      const r = await Pembayaran.status(t.kode);
      if (!r || r.status !== "lunas" || kodeAktif !== t.kode) return;
      hentikanPantau();
      $("#bayarOkInfo").textContent = `Kos "${bayarKos.nama}" tayang sampai ${Pembayaran.tanggal(r.aktif_sampai)}.`;
      tampilBayar("bayarOk");
      setTimeout(async () => {
        if (dlgBayar.open) dlgBayar.close();
        await muat();
      }, 2200);
    } catch {
      /* gangguan sesaat: coba lagi pada putaran berikutnya */
    }
  }, 2000);
}

$("#btnBatalBayar").addEventListener("click", tutupBayar);
$("#btnTutupQr").addEventListener("click", tutupBayar);
dlgBayar.addEventListener("close", hentikanPantau); // juga saat ditutup dengan tombol Esc

$("#daftar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-aksi]");
  if (b) jalankan(b.dataset.aksi, b.dataset.id);
});
// Tombol di tab Home: pindah tab atau perpanjang/bayar
$("#panelHome").addEventListener("click", (e) => {
  const b = e.target.closest("[data-aksi]");
  if (!b) return;
  if (b.dataset.aksi === "ke-tab") { tab = b.dataset.id; notif(""); aturTab(); return; }
  jalankan(b.dataset.aksi, b.dataset.id);
});
document.querySelectorAll(".own-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; notif(""); aturTab(); }));

(async function init() {
  profil = await Auth.require(["pemilik"]);
  if (!profil) return;
  if (profil.ditolak) {
    $("#app").innerHTML =
      '<p class="dash-empty">Halaman ini khusus akun pemilik kos.</p>';
    return;
  }
  const kode = new URLSearchParams(location.search).get("pesan");
  if (kode && Object.prototype.hasOwnProperty.call(PESAN, kode)) {
    notif(PESAN[kode], "ok");
    tab = "kos"; // setelah menyimpan kos, langsung tampilkan daftar kos
  }
  try {
    await muat();
  } catch (err) {
    $("#daftar").innerHTML = ""; // buang skeleton bila gagal memuat
    $("#panelHome").innerHTML = "";
    aturTab();
    notif(
      "Gagal memuat data: " + ((err && err.message) || "coba lagi."),
      "error",
    );
  }
})();