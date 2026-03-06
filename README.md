# FutuhilHidayahwalNikmah

Sistem manajemen TPQ berbasis Next.js (App Router) untuk pengelolaan santri, pembayaran SPP, infak/sedekah, pengeluaran, jurnal kas, dan pelaporan.

## Stack

- Next.js 16
- React 19
- Sequelize + MySQL
- Tailwind CSS

## Persiapan Lokal

### 1) Prasyarat

- Node.js `>=20 <23`
- MySQL/MariaDB aktif

### 2) Install dependency

```bash
npm install
```

### 3) Buat file environment

Buat `.env.local` di root project.

Contoh minimal:

```env
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=tpq_futuhil_hidayah
DB_USER=root
DB_PASSWORD=
DB_SSL=false

JWT_SECRET=ganti_dengan_secret_panjang_acak
JWT_EXPIRES_IN=7d
```

Untuk SMTP (opsional):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alamat@email.com
SMTP_PASS=app_password
SMTP_FROM=TPQ <alamat@email.com>
```

### 4) Migrasi database

```bash
npm run db:migrate
```

### 5) Jalankan aplikasi

```bash
npm run dev
```

## Script Penting

- `npm run dev` : jalankan development server
- `npm run build` : build production
- `npm run start` : jalankan production server
- `npm run lint` : lint project
- `npm run db:migrate` : sinkronisasi tabel + bootstrap data default
- `npm run db:seed` : reset data minimal (gunakan dengan hati-hati)
- `npm run db:check` : audit integritas database (duplikasi, orphan, konsistensi saldo)

## Audit Teknis (Ringkas)

Audit yang sudah ditangani:

- Keamanan token diperketat: `JWT_SECRET` wajib ada di production.
- Parser cookie auth dibuat lebih robust untuk request App Router.
- Konfigurasi `viewport` dipindah ke pola metadata Next.js modern.
- `package.json` diselaraskan agar kompatibel deploy Vercel (Node runtime + script migrasi).
- Konsistensi kelas tombol UI di halaman santri diperbaiki.

## Catatan Tabel/Model

Relasi inti:

- `Role` → banyak `Admin`
- `Admin` → banyak transaksi (`PembayaranSPP`, `InfakSedekah`, `Pengeluaran`, `JurnalKas`, dst)
- `Santri` → banyak `PembayaranSPP` dan `PembayaranLain`

Saldo kas utama bersumber dari `JurnalKas.saldo_berjalan` dan diverifikasi ulang dari akumulasi jurnal masuk/keluar.

## Rencana Deploy ke Vercel (Disarankan)

### A. Persiapan database produksi

1. Siapkan MySQL cloud (Aiven, PlanetScale, Railway, dsb).
2. Isi env DB produksi di Vercel (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
3. Jika provider mewajibkan TLS, set:
    - `DB_SSL=true`
    - `DB_SSL_CA` jika memakai custom CA cert.

### B. Set environment variables di Vercel

Wajib:

- `JWT_SECRET` (panjang, acak, rahasia)
- `JWT_EXPIRES_IN` (contoh `7d`)
- semua variabel `DB_*`

Opsional email:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### C. Build settings Vercel

- Framework: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output: default Next.js

### D. Migrasi database produksi

Jalankan satu kali sebelum go-live:

```bash
npm run db:migrate
```

Jalankan dari environment yang mengarah ke DB produksi (lokal dengan env produksi, CI job, atau server maintenance).

### E. Verifikasi pasca deploy

Checklist:

1. Login admin berhasil.
2. Endpoint `/api/dana` mengembalikan ringkasan tanpa error.
3. Tambah santri + pembayaran SPP berhasil dan jurnal kas ikut bertambah.
4. Logout membersihkan sesi.
5. Test email dari menu pengaturan berhasil (jika SMTP diaktifkan).

## Keamanan Operasional

- Jangan gunakan kredensial default untuk produksi.
- Ganti password/PIN admin awal setelah bootstrap pertama.
- Simpan semua secret di Vercel Environment Variables, bukan di repo.