# FutuhilHidayahwalNikmah

Sistem manajemen TPQ berbasis **Next.js 16** (App Router) untuk pengelolaan santri, pembayaran SPP, infak/sedekah, pengeluaran, jurnal kas, dan pelaporan.

> **Aplikasi mobile terkait:** [TPQ Link](../tpq-link) — aplikasi Flutter untuk admin di smartphone.

---

## Stack Teknologi

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 3 |
| ORM / Database | Sequelize + MySQL / MariaDB |
| Auth | JWT (cookie httpOnly) |
| Email | Nodemailer (SMTP opsional) |
| Deploy | Vercel (disarankan) / Node.js server |

---

## Struktur Modul

| Modul | Keterangan |
|---|---|
| Santri | CRUD data santri, filter, ekspor |
| Pembayaran SPP | Catat & histori pembayaran bulanan |
| Pembayaran Lain | Pembayaran non-rutin |
| Infak/Sedekah | Pemasukan sukarela |
| Pengeluaran | Pengeluaran operasional |
| Jurnal Kas | Arus kas masuk/keluar + saldo berjalan |
| Laporan | Ringkasan keuangan periodik |
| Pengaturan | Manajemen admin, profil, SMTP |

---

## Prasyarat

- **Node.js** `>=20 <23`
- **MySQL / MariaDB** yang sudah berjalan
- npm `>=10` (bawaan Node 20)

---

## Setup Lokal

### 1. Install dependency

```bash
npm install
```

### 2. Buat file environment

Salin template berikut ke file `.env.local` di root project:

```env
NODE_ENV=development
DEV_SECRET=xxxxxxxxxxxxxx

# ── Database ──────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tpq_futuhil_hidayah
DB_USER=root
DB_PASSWORD=
DB_SSL=false
# DB_SSL_CA=/path/to/ca.pem   # hanya jika provider mewajibkan

# ── Auth ──────────────────────────────────────────────
JWT_SECRET=ganti_dengan_string_panjang_acak_rahasia
JWT_EXPIRES_IN=7d

# ── SMTP (opsional) ───────────────────────────────────
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=alamat@email.com
# SMTP_PASS=app_password
# SMTP_FROM=TPQ <alamat@email.com>
```

> **Produksi:** `JWT_SECRET` wajib diisi dengan string acak ≥32 karakter. Jangan gunakan nilai default.

### 3. Sinkronisasi database & data awal

```bash
npm run db:migrate
```

Perintah ini membuat semua tabel dan mengisi data bootstrap (role, admin default).

### 4. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## Script NPM

| Script | Fungsi |
|---|---|
| `npm run dev` | Development server (hot reload) |
| `npm run build` | Build production |
| `npm run start` | Jalankan production server |
| `npm run lint` | Lint kode dengan ESLint |
| `npm run db:migrate` | Sinkronisasi tabel + bootstrap data default |
| `npm run db:seed` | Reset data minimal — **hati-hati di produksi!** |
| `npm run db:check` | Audit integritas DB (duplikasi, orphan, saldo) |

---

## Deploy ke Vercel

### A. Siapkan database cloud

Gunakan provider MySQL cloud: **Aiven**, **PlanetScale**, **Railway**, atau **Turso** (libSQL).

### B. Set environment variables di Vercel

**Wajib:**

```

JWT_SECRET=...
JWT_EXPIRES_IN=7d
DB_HOST=...
DB_PORT=3306
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
DB_SSL=true           ← biasanya wajib di cloud provider
```

**Opsional (email):**

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=TPQ <...>
```

### C. Build settings di Vercel

| Setting | Nilai |
|---|---|
| Framework | Next.js |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output | (default Next.js) |

### D. Migrasi database produksi

Jalankan **satu kali** sebelum go-live dari environment yang sudah terhubung ke DB produksi:

```bash
npm run db:migrate
```

### E. Checklist pasca deploy

- [ ] Login admin berhasil
- [ ] Endpoint `/api/dana` mengembalikan ringkasan tanpa error
- [ ] Tambah santri baru berhasil
- [ ] Pembayaran SPP berhasil + jurnal kas ikut bertambah
- [ ] Logout membersihkan sesi
- [ ] Test email dari menu Pengaturan berhasil (jika SMTP aktif)

---

## Relasi Model Utama

```
Role ──< Admin ──< PembayaranSPP
                ──< PembayaranLain
                ──< InfakSedekah
                ──< Pengeluaran
                ──< JurnalKas

Santri ──< PembayaranSPP
       ──< PembayaranLain
```

Saldo kas utama bersumber dari `JurnalKas.saldo_berjalan` — diverifikasi oleh `npm run db:check`.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `DATABASE_URL / DB_* undefined` | Pastikan `.env.local` ada dan variabel DB sudah diisi |
| Tabel tidak ditemukan | Jalankan `npm run db:migrate` |
| `JWT_SECRET is required in production` | Isi `JWT_SECRET` di `.env.local` atau env platform |
| Login gagal setelah migrate | Gunakan kredensial admin default atau jalankan `npm run db:seed` |
| Error koneksi DB di Vercel | Set `DB_SSL=true` dan pastikan IP server diizinkan di provider |
| Port 3000 sudah dipakai | `PORT=3001 npm run dev` |

---

## Keamanan Operasional

- Ganti password admin default segera setelah bootstrap pertama.
- Gunakan `JWT_SECRET` berbeda di setiap environment.
- Aktifkan `DB_SSL=true` untuk koneksi database cloud.
- Jangan commit file `.env.local` ke version control.

---

## Keterkaitan dengan TPQ Link (Mobile)

Aplikasi mobile [TPQ Link](../tpq-link) (Flutter) terhubung ke API server ini.  
Pastikan server dapat diakses dari device/emulator saat development, atau deploy ke Vercel untuk digunakan di produksi.

---

## Lisensi

Milik TPQ Futuhil Hidayah Wal Nikmah. Penggunaan untuk keperluan internal organisasi.
