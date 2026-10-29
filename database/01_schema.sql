-- 1) profiles: data tambahan untuk akun login
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nama        text not null,
  no_telepon  text,
  role        text not null default 'pencari'
              check (role in ('pencari', 'pemilik', 'admin')),
  created_at  timestamptz not null default now()
);

-- 2) kos: data inti, dimiliki oleh satu pemilik
create table kos (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references profiles (id) on delete cascade,
  nama              text not null,
  deskripsi         text,
  alamat            text not null,
  latitude          numeric(10, 7) not null,
  longitude         numeric(10, 7) not null,
  tipe              text not null check (tipe in ('Putra', 'Putri', 'Campur')),
  rating            numeric(2, 1) not null default 0,
  jarak_terdekat    text,
  no_whatsapp       text,
  status            text not null default 'draft'
                    check (status in ('draft', 'menunggu', 'aktif', 'ditolak')),
  alasan_penolakan  text,
  created_at        timestamptz not null default now()
);

-- 3) kamar: satu kos punya banyak kamar
create table kamar (
  id           bigint generated always as identity primary key,
  kos_id       bigint not null references kos (id) on delete cascade,
  nomor_kamar  text not null,
  harga        integer not null check (harga >= 0),
  status       text not null default 'tersedia' check (status in ('tersedia', 'terisi')),
  created_at   timestamptz not null default now(),
  unique (kos_id, nomor_kamar)
);

-- 4) fasilitas + penghubung many-to-many dengan kos
create table fasilitas (
  id        bigint generated always as identity primary key,
  nama      text not null unique,
  kategori  text not null check (kategori in ('kamar', 'bersama'))
);

create table kos_fasilitas (
  kos_id        bigint not null references kos (id) on delete cascade,
  fasilitas_id  bigint not null references fasilitas (id) on delete cascade,
  primary key (kos_id, fasilitas_id)
);

-- 5) aturan dan galeri foto
create table aturan (
  id      bigint generated always as identity primary key,
  kos_id  bigint not null references kos (id) on delete cascade,
  isi     text not null,
  urutan  smallint not null default 0
);

create table kos_gambar (
  id      bigint generated always as identity primary key,
  kos_id  bigint not null references kos (id) on delete cascade,
  path    text not null,                 -- URL penuh (data contoh) atau path di Supabase Storage
  urutan  smallint not null default 0    -- urutan 0 = foto utama
);

-- 6) favorit (dipakai jika pencari kos punya akun)
create table favorit (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  kos_id      bigint not null references kos (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, kos_id)
);

-- Index untuk kolom foreign key
create index on kos (user_id);
create index on kos (status, tipe);
create index on kamar (kos_id);
create index on kos_fasilitas (fasilitas_id);
create index on aturan (kos_id);
create index on kos_gambar (kos_id);
create index on favorit (kos_id);

-- KEAMANAN: aktifkan RLS di semua tabel (tanpa policy = tertutup dulu)
alter table profiles      enable row level security;
alter table kos           enable row level security;
alter table kamar         enable row level security;
alter table fasilitas     enable row level security;
alter table kos_fasilitas enable row level security;
alter table aturan        enable row level security;
alter table kos_gambar    enable row level security;
alter table favorit       enable row level security;