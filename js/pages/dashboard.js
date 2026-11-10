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
  if (k.status === "aktif") {
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

  return `<article class="dash-card">
    <div class="dash-thumb">${thumb}</div>
    <div class="dash-info">
      <div class="dash-row"><h2>${esc(k.nama)}</h2><span class="dash-badge ${st.kelas}">${st.label}</span></div>
      <p class="dash-meta">${esc(k.tipe)} · ${esc(k.alamat)}</p>
      <p class="dash-meta">${tersedia} dari ${k.kamar.length} kamar tersedia · mulai ${mulai}</p>
      <p class="dash-hint">${st.info}</p>
      ${k.status === "ditolak" ? `<p class="dash-alasan"><b>Alasan penolakan:</b> ${esc(k.alasan_penolakan || "-")}</p>` : ""}
      <div class="dash-actions">${aksi.join("")}</div>
    </div>
  </article>`;
}

function ringkasan() {
  const hitung = (s) => daftar.filter((k) => k.status === s).length;
  $("#ringkasan").textContent = daftar.length
    ? `${daftar.length} kos · ${hitung("aktif")} tayang · ${hitung("menunggu")} menunggu · ${hitung("draft")} draft · ${hitung("ditolak")} ditolak`
    : "Anda belum memasang kos.";
}

async function muat() {
  daftar = await Owner.daftarKos(profil.id);
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
    notif(
      "Gagal memuat data: " + ((err && err.message) || "coba lagi."),
      "error",
    );
  }
})();
