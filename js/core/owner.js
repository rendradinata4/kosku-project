// Fungsi data khusus pemilik kos.
// Hak akses dijaga RLS di database; kode ini hanya meminta data dan meneruskan galat yang dikembalikan.

const cek = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const Owner = {
  MAKS_FOTO: 10,

  // URL siap pakai: data contoh berupa URL penuh, unggahan pemilik berupa path di Supabase Storage
  urlFoto(path) {
    return /^https?:\/\//.test(path) ? path : db.storage.from("kos-foto").getPublicUrl(path).data.publicUrl;
  },

  // 0812-3456-7890 / +62 812... -> 628123456789 (format yang dipakai tautan wa.me)
  normalisasiWa(s) {
    let d = String(s || "").replace(/\D/g, "");
    if (d.startsWith("0")) d = "62" + d.slice(1);
    else if (d.startsWith("8")) d = "62" + d;
    return d;
  },

  // Mengembalikan daftar pesan kesalahan (kosong = valid)
  validasi(f, ajukan) {
    const e = [];
    if ((f.nama || "").trim().length < 3) e.push("Nama kos minimal 3 karakter.");
    if ((f.alamat || "").trim().length < 5) e.push("Alamat wajib diisi.");
    if (!["Putra", "Putri", "Campur"].includes(f.tipe)) e.push("Pilih tipe kos.");
    if (!Number.isFinite(f.latitude) || !Number.isFinite(f.longitude)) e.push("Tentukan lokasi kos dengan mengklik peta.");

    const dipakai = new Set();
    f.kamar.forEach((k, i) => {
      const n = String(k.nomor_kamar || "").trim();
      if (!n) e.push(`Kamar #${i + 1}: nomor kamar wajib diisi.`);
      else if (dipakai.has(n.toLowerCase())) e.push(`Nomor kamar "${n}" dipakai lebih dari sekali.`);
      dipakai.add(n.toLowerCase());
      if (!Number.isInteger(k.harga) || k.harga <= 0) e.push(`Kamar ${n || "#" + (i + 1)}: harga harus berupa angka lebih dari 0.`);
    });

    const jumlahFoto = (f.foto || []).length;
    if (jumlahFoto > Owner.MAKS_FOTO) e.push(`Maksimal ${Owner.MAKS_FOTO} foto per kos.`);

    if (ajukan) {
      if (!/^62\d{8,12}$/.test(f.no_whatsapp || "")) e.push("Nomor WhatsApp wajib diisi dengan benar (contoh: 081234567890).");
      if (f.kamar.length < 1) e.push("Tambahkan minimal satu kamar sebelum mengajukan.");
      if (jumlahFoto < 1) e.push("Unggah minimal satu foto sebelum mengajukan.");
    }
    return e;
  },

  kolomKos(f) {
    return {
      nama: f.nama.trim(),
      deskripsi: (f.deskripsi || "").trim() || null,
      alamat: f.alamat.trim(),
      latitude: f.latitude,
      longitude: f.longitude,
      tipe: f.tipe,
      jarak_terdekat: (f.jarak_terdekat || "").trim() || null,
      no_whatsapp: f.no_whatsapp || null,
    };
  },

  async fasilitas() {
    return cek(await db.from("fasilitas").select("id, nama, kategori").order("kategori").order("nama"));
  },

  async daftarKos(uid) {
    return cek(
      await db
        .from("kos")
        .select("id, nama, alamat, tipe, status, alasan_penolakan, no_whatsapp, kamar ( harga, status ), kos_gambar ( path, urutan )")
        .eq("user_id", uid)
        .order("id", { ascending: false }),
    );
  },

  // Satu kos milik pemilik ini, lengkap dengan relasinya (null jika tidak ada / bukan miliknya)
  async ambilKos(id, uid) {
    return cek(
      await db
        .from("kos")
        .select("*, kos_fasilitas ( fasilitas_id ), aturan ( isi, urutan ), kamar ( id, nomor_kamar, harga, status ), kos_gambar ( id, path, urutan )")
        .eq("id", id)
        .eq("user_id", uid)
        .maybeSingle(),
    );
  },

  async simpanBaru(uid, f, ajukan) {
    const kos = cek(
      await db
        .from("kos")
        .insert({ user_id: uid, ...Owner.kolomKos(f), status: ajukan ? "menunggu" : "draft" })
        .select("id")
        .single(),
    );
    try {
      await Owner.isiTurunan(kos.id, f);
      await Owner.simpanFoto(uid, kos.id, f.foto || []);
    } catch (err) {
      try {
        await Owner.hapus(kos.id); // batalkan kos setengah jadi beserta file fotonya
      } catch (e) {
        /* abaikan: galat aslinya yang ditampilkan */
      }
      throw err;
    }
    return kos.id;
  },

  // Mengembalikan status akhir kos (bisa berubah otomatis menjadi 'menunggu' bila data utama kos aktif diubah)
  async simpanUbah(id, f, ajukan, uid) {
    const ubah = Owner.kolomKos(f);
    if (ajukan) ubah.status = "menunggu";
    const baris = cek(await db.from("kos").update(ubah).eq("id", id).select("id"));
    if (!baris || !baris.length) throw new Error("Kos tidak ditemukan atau bukan milik Anda.");
    await Owner.isiTurunan(id, f);
    await Owner.simpanFoto(uid, id, f.foto || []);
    return cek(await db.from("kos").select("status").eq("id", id).single()).status;
  },

  // Fasilitas, aturan, dan kamar: diganti sesuai isi form
  async isiTurunan(kosId, f) {
    cek(await db.from("kos_fasilitas").delete().eq("kos_id", kosId));
    if (f.fasilitasIds.length) {
      cek(await db.from("kos_fasilitas").insert(f.fasilitasIds.map((fid) => ({ kos_id: kosId, fasilitas_id: fid }))));
    }

    cek(await db.from("aturan").delete().eq("kos_id", kosId));
    const aturan = f.aturan.map((s) => s.trim()).filter(Boolean);
    if (aturan.length) {
      cek(await db.from("aturan").insert(aturan.map((isi, i) => ({ kos_id: kosId, isi, urutan: i }))));
    }

    await Owner.simpanKamar(kosId, f.kamar);
  },

  async simpanKamar(kosId, rows) {
    const ada = cek(await db.from("kamar").select("id").eq("kos_id", kosId)).map((r) => r.id);
    const tetap = rows.filter((r) => r.id).map((r) => r.id);
    const dihapus = ada.filter((id) => !tetap.includes(id));
    if (dihapus.length) cek(await db.from("kamar").delete().in("id", dihapus));

    for (const r of rows.filter((r) => r.id)) {
      cek(await db.from("kamar").update({ nomor_kamar: r.nomor_kamar.trim(), harga: r.harga, status: r.status }).eq("id", r.id));
    }

    const baru = rows
      .filter((r) => !r.id)
      .map((r) => ({ kos_id: kosId, nomor_kamar: r.nomor_kamar.trim(), harga: r.harga, status: r.status }));
    if (baru.length) cek(await db.from("kamar").insert(baru));
  },

  async ubahStatus(id, status) {
    const baris = cek(await db.from("kos").update({ status }).eq("id", id).select("id"));
    if (!baris || !baris.length) throw new Error("Kos tidak ditemukan atau bukan milik Anda.");
  },

  async hapus(id) {
    const foto = cek(await db.from("kos_gambar").select("path").eq("kos_id", id)) || [];
    const baris = cek(await db.from("kos").delete().eq("id", id).select("id"));
    if (!baris || !baris.length) throw new Error("Kos tidak ditemukan atau bukan milik Anda.");
    await Owner.hapusFile(foto.map((x) => x.path));
  },

  // ---------- Foto ----------
  // Perkecil foto (sisi terpanjang maks. 1600 px) dan ubah ke JPEG: unggahan cepat dan hemat penyimpanan
  async kompres(file, maks = 1600, kualitas = 0.82) {
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch (e) {
      throw new Error(`"${file.name}" bukan gambar yang valid.`);
    }
    const skala = Math.min(1, maks / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * skala));
    c.height = Math.max(1, Math.round(bmp.height * skala));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG transparan -> latar putih
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", kualitas));
    if (!blob) throw new Error(`Gagal memproses "${file.name}".`);
    return blob;
  },

  // Unggah satu foto ke folder <id-pemilik>/<id-kos>/ dan kembalikan path-nya
  async unggah(uid, kosId, file) {
    const blob = await Owner.kompres(file);
    const acak = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const path = `${uid}/${kosId}/${acak}.jpg`;
    const { error } = await db.storage.from("kos-foto").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) throw error;
    return path;
  },

  // Menghapus file dari Storage (URL luar dilewati). Kegagalan tidak fatal: file yatim hanya memakan ruang.
  async hapusFile(paths) {
    const milikStorage = paths.filter((p) => !/^https?:\/\//.test(p));
    if (!milikStorage.length) return;
    try {
      await db.storage.from("kos-foto").remove(milikStorage);
    } catch (e) {
      /* abaikan */
    }
  },

  // items: urutan foto di form. Yang punya id = sudah tersimpan; yang punya file = baru.
  async simpanFoto(uid, kosId, items) {
    const ada = cek(await db.from("kos_gambar").select("id, path").eq("kos_id", kosId)) || [];
    const dipertahankan = new Set(items.filter((x) => x.id).map((x) => x.id));
    const dibuang = ada.filter((r) => !dipertahankan.has(r.id));
    if (dibuang.length) {
      cek(await db.from("kos_gambar").delete().in("id", dibuang.map((r) => r.id)));
      await Owner.hapusFile(dibuang.map((r) => r.path));
    }

    for (const [i, it] of items.entries()) {
      if (it.id) {
        if (it.urutan !== i) cek(await db.from("kos_gambar").update({ urutan: i }).eq("id", it.id));
      } else {
        const path = await Owner.unggah(uid, kosId, it.file);
        try {
          cek(await db.from("kos_gambar").insert({ kos_id: kosId, path, urutan: i }));
        } catch (err) {
          await Owner.hapusFile([path]);
          throw err;
        }
      }
    }
  },
};