# Script Cleanup: Hapus Jurnal Penyesuaian yang Salah

## Masalah
Ketika edit pengeluaran dengan bug sebelumnya, sistem membuat jurnal penyesuaian (ADJ) di tanggal yang salah. Jurnal ini masih tersisa di database dan menyebabkan pengeluaran muncul di bulan yang salah.

## Solusi

### Opsi 1: Via API Endpoint (Paling Mudah)

1. **Lihat dulu jurnal yang akan dihapus:**

   Buka browser atau gunakan curl:
   ```bash
   curl http://localhost:3000/api/cleanup/jurnal-pengeluaran \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Hapus jurnal penyesuaian:**
   ```bash
   curl -X POST http://localhost:3000/api/cleanup/jurnal-pengeluaran \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"pin": "YOUR_PIN"}'
   ```

   Response:
   ```json
   {
     "success": true,
     "pesan": "Berhasil menghapus 2 jurnal penyesuaian",
     "deleted_count": 2
   }
   ```

### Opsi 2: Via Database (MySQL)

Jalankan query SQL berikut:

```sql
-- Lihat dulu jurnal penyesuaian yang ada
SELECT 
    id,
    tgl_transaksi,
    tanggal_aksi,
    jenis,
    nominal,
    referensi_kode,
    keterangan
FROM jurnal_kas
WHERE referensi_kode LIKE 'ADJ-%'
  AND keterangan LIKE '%Penyesuaian pengeluaran%'
ORDER BY tgl_transaksi DESC;

-- Hapus jurnal penyesuaian untuk semua pengeluaran
DELETE FROM jurnal_kas
WHERE referensi_kode LIKE 'ADJ-OUT-%'
  AND keterangan LIKE '%Penyesuaian pengeluaran%';

-- ATAU hapus untuk pengeluaran tertentu saja
-- DELETE FROM jurnal_kas
-- WHERE referensi_kode = 'ADJ-OUT-XXXXX';  -- ganti dengan kode yang spesifik
```

---

## Setelah Cleanup

1. **Refresh halaman `/admin/dana`**
2. Pengeluaran Rp 1.000 di Maret 2026 seharusnya **hilang**
3. Pengeluaran seharusnya muncul di **Desember 2024** sesuai tanggal yang kamu set

---

## Verifikasi

Jalankan query ini untuk memastikan data sudah benar:

```sql
-- Cek pengeluaran di Desember 2024
SELECT * FROM pengeluaran 
WHERE tgl_keluar BETWEEN '2024-12-01' AND '2024-12-31'
ORDER BY tgl_keluar DESC;

-- Cek jurnal di Maret 2026 (seharusnya TIDAK ada ADJ)
SELECT * FROM jurnal_kas
WHERE tgl_transaksi BETWEEN '2026-03-01' AND '2026-03-31'
  AND referensi_kode LIKE 'ADJ-%';

-- Cek jurnal di Desember 2024 (seharusnya ADA entry yang benar)
SELECT * FROM jurnal_kas
WHERE tgl_transaksi BETWEEN '2024-12-01' AND '2024-12-31'
  AND (referensi_kode LIKE 'OUT-%' OR referensi_kode LIKE 'ADJ-OUT-%')
ORDER BY tgl_transaksi DESC;
```

---

## Catatan Penting

- **Endpoint cleanup** hanya bisa diakses oleh user dengan jabatan **Developer**
- Backup database terlebih dahulu jika tidak yakin
- Setelah cleanup, edit ulang pengeluaran jika diperlukan untuk membuat jurnal yang benar
