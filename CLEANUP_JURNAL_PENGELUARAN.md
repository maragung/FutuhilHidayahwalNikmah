# Script Cleanup: Hapus Jurnal Penyesuaian yang Salah

## Masalah
Ketika edit pengeluaran dengan bug sebelumnya, sistem membuat jurnal penyesuaian (ADJ) di tanggal yang salah. Meskipun pengeluaran sudah dihapus, jurnal ADJ ini **masih tersisa** di database dan menyebabkan:
- Total Pengeluaran masih muncul Rp 1.000
- Transaksi muncul di bulan yang salah (Maret 2026)

---

## Solusi Cepat (PILIH SALAH SATU)

### Opsi 1: Via UI (Termudah - Recommended)

1. Login sebagai **Developer**
2. Buka menu **Cleanup Jurnal** di sidebar kiri
3. Lihat preview jurnal yang akan dihapus
4. Masukkan PIN dan klik **"Hapus Jurnal"**
5. Refresh halaman `/admin/dana` atau `/admin/dashboard`

### Opsi 2: Via Database SQL (Langsung Bersih)

Jalankan query SQL berikut di phpMyAdmin atau MySQL client:

```sql
-- LIHAT DULU jurnal yang akan dihapus
SELECT 
    id,
    tgl_transaksi,
    jenis,
    nominal,
    referensi_kode,
    keterangan
FROM jurnal_kas
WHERE referensi_kode LIKE 'ADJ-%'
  AND keterangan LIKE '%Penyesuaian pengeluaran%'
ORDER BY tgl_transaksi DESC;

-- HAPUS jurnal penyesuaian (SETALAH MENYAKINKAN DATA DI ATAS BENAR)
DELETE FROM jurnal_kas
WHERE referensi_kode LIKE 'ADJ-%'
  AND keterangan LIKE '%Penyesuaian pengeluaran%';

-- VERIFIKASI: seharusnya tidak ada hasil
SELECT * FROM jurnal_kas
WHERE referensi_kode LIKE 'ADJ-%'
  AND keterangan LIKE '%Penyesuaian pengeluaran%';
```

### Opsi 3: Via API Endpoint

```bash
# Lihat preview
curl http://localhost:3000/api/cleanup/jurnal-pengeluaran \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Hapus jurnal
curl -X POST http://localhost:3000/api/cleanup/jurnal-pengeluaran \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "YOUR_PIN"}'
```

---

## Setelah Cleanup

1. **Refresh halaman** `/admin/dana` atau `/admin/dashboard`
2. Pengeluaran Rp 1.000 di Maret 2026 akan **hilang**
3. Total Pengeluaran 2026 akan menjadi **Rp 0** dengan **0 transaksi**

---

## Verifikasi

Jalankan query ini untuk memastikan data sudah benar:

```sql
-- Cek total pengeluaran di 2026 (harus Rp 0 jika sudah cleanup)
SELECT 
  YEAR(tgl_transaksi) as tahun,
  COUNT(*) as jumlah_transaksi,
  SUM(nominal) as total_nominal
FROM jurnal_kas
WHERE jenis = 'Keluar'
  AND YEAR(tgl_transaksi) = 2026
GROUP BY YEAR(tgl_transaksi);

-- Cek jurnal di Maret 2026 (tidak boleh ada ADJ)
SELECT * FROM jurnal_kas
WHERE tgl_transaksi BETWEEN '2026-03-01' AND '2026-03-31'
  AND referensi_kode LIKE 'ADJ-%';
```

---

## Perbaikan yang Sudah Diterapkan

1. **Edit Pengeluaran** - Sekarang menangani perubahan tanggal dengan benar:
   - Reverse di tanggal lama + Entry baru di tanggal baru
   
2. **Hapus Pengeluaran** - Sekarang otomatis membersihkan jurnal ADJ terkait

3. **Cleanup Endpoint** - Untuk membersihkan jurnal ADJ yang tersisa

---

## Catatan Penting

- **Endpoint cleanup** hanya bisa diakses oleh user dengan jabatan **Developer**
- Backup database terlebih dahulu jika tidak yakin
- Setelah cleanup, tidak perlu edit ulang pengeluaran kecuali memang ada data yang salah
