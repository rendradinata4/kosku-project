-- =====================================================================
-- 02_pembayaran.sql — Biaya publikasi kos (pembayaran QR simulasi)
-- Jalankan SEKALI di Supabase > SQL Editor (aman diulang: memakai "if not exists" / "or replace").
--
-- Alur status kos yang baru:
--   draft -> menunggu (diajukan) -> menunggu_pembayaran (disetujui admin) -> aktif (dibayar)
-- Jika kos sudah pernah dibayar dan masa tayangnya masih berlaku (mis. kos diubah lalu
-- diajukan ulang), persetujuan admin langsung membuat kos aktif tanpa bayar lagi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Status baru: menunggu_pembayaran
-- ---------------------------------------------------------------------
alter table public.kos drop constraint if exists kos_status_check;
alter table public.kos add constraint kos_status_check
  check (status in ('draft', 'menunggu', 'menunggu_pembayaran', 'aktif', 'ditolak'));

-- ---------------------------------------------------------------------
-- 2. Tabel pembayaran
--    nama_kos / nama_pemilik disimpan sebagai salinan supaya riwayat keuangan tetap
--    utuh walaupun kos atau akun pemiliknya kelak dihapus.
-- ---------------------------------------------------------------------
create table if not exists public.pembayaran (
  id               uuid primary key default gen_random_uuid(),
  kode             text not null unique,
  kos_id           bigint references public.kos (id) on delete set null,
  user_id          uuid references public.profiles (id) on delete set null,
  nama_kos         text not null,
  nama_pemilik     text not null default '',
  bulan            int  not null check (bulan in (1, 3, 12)),
  nominal          int  not null check (nominal > 0),
  status           text not null default 'pending' check (status in ('pending', 'lunas', 'kedaluwarsa')),
  dibuat_pada      timestamptz not null default now(),
  kedaluwarsa_pada timestamptz not null,
  dibayar_pada     timestamptz,
  aktif_sampai     timestamptz
);
create index if not exists pembayaran_user_idx on public.pembayaran (user_id);
create index if not exists pembayaran_kos_idx on public.pembayaran (kos_id);

alter table public.pembayaran enable row level security;

-- Tabel hanya bisa DIBACA oleh pengguna yang login (dan dibatasi policy di bawah);
-- semua perubahan hanya lewat fungsi di bawah. Pengunjung tanpa login tidak punya akses langsung.
revoke all on public.pembayaran from anon, authenticated;
grant select on public.pembayaran to authenticated;

drop policy if exists "pembayaran.pemilik baca sendiri" on public.pembayaran;
create policy "pembayaran.pemilik baca sendiri" on public.pembayaran
  for select using (user_id = (select auth.uid()));

drop policy if exists "pembayaran.admin baca semua" on public.pembayaran;
create policy "pembayaran.admin baca semua" on public.pembayaran
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Penjaga perubahan kos: tambahkan pengecualian untuk fungsi pembayaran.
--    bayar_pembayaran() bisa dipanggil dari HP yang kebetulan sedang login sebagai pemilik;
--    tanpa pengecualian ini, perubahan status menjadi 'aktif' akan ditolak aturan di bawah.
-- ---------------------------------------------------------------------
create or replace function public.kos_jaga_perubahan()
 returns trigger
 language plpgsql
as $function$
begin
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('app.pembayaran', true), '') <> 'on' then
    if new.status is distinct from old.status and new.status not in ('draft', 'menunggu') then
      raise exception 'Pemilik hanya boleh mengubah status menjadi draft atau menunggu';
    end if;

    if old.status = 'aktif' and new.status = 'aktif'
       and (new.nama, new.alamat, new.latitude, new.longitude, new.tipe, new.deskripsi)
           is distinct from
           (old.nama, old.alamat, old.latitude, old.longitude, old.tipe, old.deskripsi) then
      new.status := 'menunggu';
    end if;
  end if;
  return new;
end $function$;

-- ---------------------------------------------------------------------
-- 4. setujui_kos: setelah disetujui, kos menunggu pembayaran
--    (atau langsung aktif bila masa tayang hasil pembayaran sebelumnya masih berlaku)
-- ---------------------------------------------------------------------
create or replace function public.setujui_kos(p_kos_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  k public.kos%rowtype;
  masih_dibayar boolean;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menyetujui kos';
  end if;
  select * into k from public.kos where id = p_kos_id;
  if not found then
    raise exception 'Kos tidak ditemukan';
  end if;
  if k.status <> 'menunggu' then
    raise exception 'Hanya kos berstatus menunggu yang bisa disetujui';
  end if;
  if not exists (select 1 from public.kos_gambar where kos_id = p_kos_id) then
    raise exception 'Kos belum memiliki foto';
  end if;
  if not exists (select 1 from public.kamar where kos_id = p_kos_id) then
    raise exception 'Kos belum memiliki kamar';
  end if;
  if coalesce(k.no_whatsapp, '') !~ '^62[0-9]{8,12}$' then
    raise exception 'Nomor WhatsApp kos tidak valid';
  end if;

  select exists (
    select 1 from public.pembayaran
     where kos_id = p_kos_id and status = 'lunas' and aktif_sampai > now()
  ) into masih_dibayar;

  update public.kos
     set status = case when masih_dibayar then 'aktif' else 'menunggu_pembayaran' end,
         alasan_penolakan = null
   where id = p_kos_id;
end $function$;

-- ---------------------------------------------------------------------
-- 5. tolak_kos: kos yang menunggu pembayaran juga boleh dibatalkan admin
-- ---------------------------------------------------------------------
create or replace function public.tolak_kos(p_kos_id bigint, p_alasan text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh menolak kos';
  end if;
  if length(trim(coalesce(p_alasan, ''))) < 5 then
    raise exception 'Alasan penolakan wajib diisi (minimal 5 karakter)';
  end if;
  select status into s from public.kos where id = p_kos_id;
  if not found then
    raise exception 'Kos tidak ditemukan';
  end if;
  if s not in ('menunggu', 'menunggu_pembayaran', 'aktif') then
    raise exception 'Hanya kos berstatus menunggu, menunggu pembayaran, atau aktif yang bisa ditolak';
  end if;
  update public.kos set status = 'ditolak', alasan_penolakan = trim(p_alasan) where id = p_kos_id;
end $function$;

-- ---------------------------------------------------------------------
-- 6. buat_pembayaran: pemilik membuat transaksi (harga dihitung di sini, bukan di browser)
--    Mengembalikan { kode, nominal, kedaluwarsa_pada }. QR berlaku 15 menit.
-- ---------------------------------------------------------------------
create or replace function public.buat_pembayaran(p_kos_id bigint, p_bulan int)
 returns json
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  k public.kos%rowtype;
  v_nominal int;
  v_kode text;
  v_exp timestamptz := now() + interval '15 minutes';
  v_nama text;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu';
  end if;
  select * into k from public.kos where id = p_kos_id;
  if not found or k.user_id <> auth.uid() then
    raise exception 'Kos tidak ditemukan';
  end if;
  if k.status not in ('menunggu_pembayaran', 'aktif') then
    raise exception 'Kos ini belum disetujui admin, jadi belum bisa dibayar';
  end if;

  v_nominal := case p_bulan when 1 then 49000 when 3 then 129000 when 12 then 449000 end;
  if v_nominal is null then
    raise exception 'Paket tidak valid';
  end if;

  -- QR lama untuk kos yang sama yang belum dibayar dibatalkan
  update public.pembayaran set status = 'kedaluwarsa' where kos_id = p_kos_id and status = 'pending';

  select nama into v_nama from public.profiles where id = auth.uid();
  v_kode := 'RN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.pembayaran (kode, kos_id, user_id, nama_kos, nama_pemilik, bulan, nominal, kedaluwarsa_pada)
  values (v_kode, p_kos_id, auth.uid(), k.nama, coalesce(v_nama, ''), p_bulan, v_nominal, v_exp);

  return json_build_object('kode', v_kode, 'nominal', v_nominal, 'kedaluwarsa_pada', v_exp);
end $function$;

-- ---------------------------------------------------------------------
-- 7. info_pembayaran: rincian tagihan untuk halaman bayar di HP (tanpa login)
-- ---------------------------------------------------------------------
create or replace function public.info_pembayaran(p_kode text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  p public.pembayaran%rowtype;
begin
  select * into p from public.pembayaran where kode = p_kode;
  if not found then
    return null;
  end if;
  return json_build_object(
    'nama_kos', p.nama_kos,
    'bulan', p.bulan,
    'nominal', p.nominal,
    'status', case when p.status = 'pending' and p.kedaluwarsa_pada < now() then 'kedaluwarsa' else p.status end,
    'kedaluwarsa_pada', p.kedaluwarsa_pada
  );
end $function$;

-- ---------------------------------------------------------------------
-- 8. bayar_pembayaran: tombol "Bayar" di HP (tanpa login). Melunasi transaksi dan
--    mengaktifkan kos. Perpanjangan menambah masa tayang dari tanggal berakhir sebelumnya.
-- ---------------------------------------------------------------------
create or replace function public.bayar_pembayaran(p_kode text)
 returns json
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  p public.pembayaran%rowtype;
  s_kos text;
  v_awal timestamptz;
  v_akhir timestamptz;
begin
  select * into p from public.pembayaran where kode = p_kode for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  if p.status = 'lunas' then
    raise exception 'Transaksi ini sudah dibayar';
  end if;
  if p.status <> 'pending' or p.kedaluwarsa_pada < now() then
    raise exception 'QR sudah kedaluwarsa. Buat QR baru dari dashboard pemilik';
  end if;

  select status into s_kos from public.kos where id = p.kos_id;
  if s_kos is null or s_kos not in ('menunggu_pembayaran', 'aktif') then
    raise exception 'Kos ini tidak lagi menunggu pembayaran';
  end if;

  select greatest(coalesce(max(aktif_sampai), now()), now()) into v_awal
    from public.pembayaran where kos_id = p.kos_id and status = 'lunas';
  v_akhir := v_awal + make_interval(months => p.bulan);

  update public.pembayaran
     set status = 'lunas', dibayar_pada = now(), aktif_sampai = v_akhir
   where id = p.id;

  -- izinkan perubahan status oleh fungsi ini (lihat kos_jaga_perubahan); berlaku hanya di transaksi ini
  perform set_config('app.pembayaran', 'on', true);
  update public.kos set status = 'aktif' where id = p.kos_id and status = 'menunggu_pembayaran';

  return json_build_object('status', 'lunas', 'aktif_sampai', v_akhir);
end $function$;

-- ---------------------------------------------------------------------
-- 9. Hak menjalankan fungsi
-- ---------------------------------------------------------------------
revoke all on function public.buat_pembayaran(bigint, int) from public;
revoke all on function public.info_pembayaran(text) from public;
revoke all on function public.bayar_pembayaran(text) from public;
grant execute on function public.buat_pembayaran(bigint, int) to authenticated;
grant execute on function public.info_pembayaran(text) to anon, authenticated;
grant execute on function public.bayar_pembayaran(text) to anon, authenticated;