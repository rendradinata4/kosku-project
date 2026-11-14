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
  const info = sampai ? `${st.info} Tayang sampai ${Pembayaran.tanggal(sampai)}.` : st.info;

  return `<article class="dash-card">
    <div class="dash-thumb">${thumb}</div>
    <div class="dash-info">
      <div class="dash-row"><h2>${esc(k.nama)}</h2><span class="dash-badge ${st.kelas}">${st.label}</span></div>
      <p class="dash-meta">${esc(k.tipe)} · ${esc(k.alamat)}</p>
      <p class="dash-meta">${tersedia} dari ${k.kamar.length} kamar tersedia · mulai ${mulai}</p>
      <p class="dash-hint">${info}</p>
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
  $("#sAktif").textContent = hitung("aktif");
  $("#sMenunggu").textContent = hitung("menunggu") + hitung("menunggu_pembayaran");
  $("#sLain").textContent = hitung("draft") + hitung("ditolak");
  $("#ringkasan").textContent = daftar.length
    ? "Berikut ringkasan seluruh kos Anda."
    : "Anda belum memasang kos.";
}

async function muat() {
  daftar = await Owner.daftarKos(profil.id);
  bayarSaya = await Pembayaran.milikSaya(profil.id).catch(() => []); // gagal = anggap belum ada
  ringkasan();
  $("#daftar").innerHTML = daftar.length
    ? daftar.map(kartu).join("")
    : '<p class="dash-empty">Belum ada kos. Klik <b>+ Tambah Kos</b> untuk memulai.</p>';
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

(async function init() {
  profil = await Auth.require(["pemilik"]);
  if (!profil) return;
  if (profil.ditolak) {
    $("#app").innerHTML =
      '<p class="dash-empty">Halaman ini khusus akun pemilik kos.</p>';
    return;
  }
  const kode = new URLSearchParams(location.search).get("pesan");
  if (kode && Object.prototype.hasOwnProperty.call(PESAN, kode))
    notif(PESAN[kode], "ok");
  try {
    await muat();
  } catch (err) {
    $("#daftar").innerHTML = ""; // buang skeleton bila gagal memuat
    notif(
      "Gagal memuat data: " + ((err && err.message) || "coba lagi."),
      "error",
    );
  }
})();