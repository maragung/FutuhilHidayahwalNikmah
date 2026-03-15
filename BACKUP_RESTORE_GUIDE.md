# 📦 Panduan Backup & Restore Database

## 🎯 Deskripsi

Sistem backup dan restore database TPQ Futuhil Hidayah Wal Hikmah menggunakan format SQL.

---

## 📁 Lokasi Backup

File backup disimpan di folder: `src/backup/`

Format nama file: `backup_tpq_futuhil_YYYY-MM-DDTHH-MM-SS.sql.gz`

---

## 🔄 BACKUP DATABASE

### Cara 1: Menggunakan NPM Script (Recommended)

```bash
npm run db:backup
```

### Cara 2: Menjalankan Script Langsung

```bash
node src/lib/backup.js
```

### Output Backup

Script akan menghasilkan:
1. **File SQL** - Database dump dalam format SQL
2. **File GZIP** - File SQL yang dikompresi (`.sql.gz`)

Contoh output:
```
📂 Lokasi backup: d:\git\FutuhilHidayahwalNikmah\src\backup
📄 File: backup_tpq_futuhil_2026-03-15T10-30-00.sql.gz
📦 Ukuran file: 2.45 MB
```

### Fitur Backup:

✅ **Otomatis menggunakan mysqldump** jika tersedia (lebih cepat)  
✅ **Fallback ke backup manual** jika mysqldump tidak ada  
✅ **Kompresi GZIP** otomatis untuk menghemat ruang  
✅ **Cleanup otomatis** - Hapus backup lebih dari 30 hari  
✅ **Struktur lengkap** - DROP TABLE + CREATE TABLE + INSERT DATA  

---

## ↩️ RESTORE DATABASE

### ⚠️ PERINGATAN PENTING!

Restore akan **MENGHAPUS SEMUA DATA** yang ada dan menggantinya dengan data dari backup!

**Sebelum restore, pastikan:**
- ✅ Anda sudah backup data terbaru
- ✅ Tidak ada transaksi yang sedang berjalan
- ✅ Semua user sudah logout

### Cara 1: Menggunakan NPM Script (Interactive)

```bash
npm run db:restore
```

Script akan:
1. Menampilkan daftar backup yang tersedia
2. Meminta Anda memilih backup
3. Meminta konfirmasi sebelum restore

### Cara 2: Menjalankan Script dengan Nama File

```bash
# File uncompressed
node src/lib/restore.js backup_tpq_futuhil_2026-03-15T10-30-00.sql

# File compressed (.gz)
node src/lib/restore.js backup_tpq_futuhil_2026-03-15T10-30-00.sql.gz
```

### Cara 3: Dari Folder Lain

```bash
node src/lib/restore.js /path/to/backup_tpq_futuhil_2026-03-15T10-30-00.sql
```

### Proses Restore:

1. **Decompress** - Jika file `.gz`, akan didecompress otomatis
2. **Validasi** - Check file SQL valid (ada CREATE TABLE, INSERT, dll)
3. **Konfirmasi** - Minta konfirmasi sebelum melanjutkan
4. **Restore** - DROP + CREATE + INSERT semua data
5. **Cleanup** - Tanya apakah file decompress ingin dihapus

---

## 📋 Contoh Penggunaan Lengkap

### Skenario 1: Backup Harian

```bash
# Backup setiap hari
npm run db:backup

# Output:
# ✅ BACKUP SELESAI
# 📂 Lokasi backup: src/backup
# 📄 File: backup_tpq_futuhil_2026-03-15T08-00-00.sql.gz
```

### Skenario 2: Restore dari Backup Tertentu

```bash
# Lihat daftar backup
npm run db:restore

# Output:
# 📂 Daftar file backup tersedia:
#    1. backup_tpq_futuhil_2026-03-15T08-00-00.sql.gz
#       Ukuran: 2.45 MB | Tanggal: 15/3/2026 08:00:00
#    
#    2. backup_tpq_futuhil_2026-03-14T08-00-00.sql.gz
#       Ukuran: 2.40 MB | Tanggal: 14/3/2026 08:00:00
# 
# Pilih nomor backup yang akan direstore: > 1

# Konfirmasi:
# ⚠️ PERINGATAN PENTING!
# Apakah Anda yakin ingin melanjutkan? (ketik "YA" untuk konfirmasi): > YA

# ✅ RESTORE SELESAI
```

### Skenario 3: Restore dari File Spesifik

```bash
node src/lib/restore.js backup_tpq_futuhil_2026-03-10T15-30-00.sql
```

---

## 🛠️ Troubleshooting

### Error: mysqldump tidak ditemukan

**Solusi 1:** Install MySQL/MariaDB lengkap
```bash
# Windows: Download dari mysql.com
# Linux: sudo apt-get install mysql-client
# Mac: brew install mysql
```

**Solusi 2:** Gunakan backup manual (otomatis fallback)
```bash
# Script akan otomatis menggunakan backup manual jika mysqldump tidak ada
```

### Error: Access denied

**Penyebab:** Username atau password salah

**Solusi:** Check file `.env.local`
```env
DB_USER=root
DB_PASSWORD=your_password
```

### Error: Database tidak ditemukan

**Penyebab:** Database belum dibuat

**Solusi:** Buat database terlebih dahulu
```sql
CREATE DATABASE tpq_futuhil CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Restore sangat lambat

**Penyebab:** Menggunakan restore manual (tanpa mysql command)

**Solusi:** Install MySQL client untuk menggunakan `mysql` command
```bash
# Backup akan 5-10x lebih cepat dengan mysql command
```

---

## 📊 Struktur File Backup

```
src/backup/
├── backup_tpq_futuhil_2026-03-15T08-00-00.sql.gz
├── backup_tpq_futuhil_2026-03-14T08-00-00.sql.gz
├── backup_tpq_futuhil_2026-03-13T08-00-00.sql.gz
└── ...
```

### Isi File SQL:

```sql
-- ============================================================
-- Backup Database: tpq_futuhil
-- Tanggal: 2026-03-15T08:00:00.000Z
-- Host: localhost
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Tabel structure: admins
-- --------------------------------------------------------
DROP TABLE IF EXISTS `admins`;

CREATE TABLE `admins` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nama_lengkap` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Data untuk tabel: admins
INSERT INTO `admins` (`id`, `nama_lengkap`) VALUES
  (1, 'Admin 1'),
  (2, 'Admin 2');

-- ... tabel lainnya ...

SET FOREIGN_KEY_CHECKS = 1;
```

---

## 🔐 Best Practices

### 1. **Backup Rutin**
```bash
# Backup setiap hari jam 00:00
# Tambahkan ke crontab (Linux/Mac) atau Task Scheduler (Windows)

# Crontab example:
0 0 * * * cd /path/to/project && npm run db:backup
```

### 2. **Simpan Backup di Lokasi Aman**
```bash
# Copy file backup ke:
# - External hard drive
# - Cloud storage (Google Drive, Dropbox, dll)
# - Server backup terpisah

cp src/backup/*.sql.gz /mnt/backup/
```

### 3. **Test Restore Berkala**
```bash
# Test restore setiap bulan di development server
# Pastikan backup bisa direstore dengan baik
```

### 4. **Retensi Backup**
```
✅ Disimpan:
   - Backup harian: 7 hari terakhir
   - Backup mingguan: 4 minggu terakhir
   - Backup bulanan: 12 bulan terakhir

❌ Dihapus otomatis:
   - Backup lebih dari 30 hari
```

---

## 📞 Support

Jika mengalami masalah:

1. Check file `.env.local` - Pastikan konfigurasi database benar
2. Check log error - Script akan menampilkan error detail
3. Test koneksi database - Pastikan database bisa diakses
4. Check permission - Pastikan user database punya akses penuh

---

**Dokumentasi ini dibuat untuk:** TPQ Futuhil Hidayah Wal Hikmah  
**Tanggal:** 15 Maret 2026  
**Versi:** 1.0
