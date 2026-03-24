# Debug: Cek Data Pengeluaran dan Jurnal

## Jalankan Query Ini

### 1. Cek Pengeluaran di 2024
```sql
SELECT 
    id,
    kode_pengeluaran,
    tgl_keluar,
    judul,
    nominal,
    kategori
FROM pengeluaran
WHERE YEAR(tgl_keluar) = 2024
ORDER BY tgl_keluar DESC;
```

### 2. Cek Jurnal Keluar di 2024 (Termasuk ADJ)
```sql
SELECT 
    id,
    tgl_transaksi,
    jenis,
    nominal,
    referensi_kode,
    keterangan
FROM jurnal_kas
WHERE YEAR(tgl_transaksi) = 2024
  AND jenis = 'Keluar'
ORDER BY tgl_transaksi DESC;
```

### 3. Cek ADJ Journals di 2024
```sql
SELECT 
    id,
    tgl_transaksi,
    jenis,
    nominal,
    referensi_kode,
    keterangan
FROM jurnal_kas
WHERE YEAR(tgl_transaksi) = 2024
  AND referensi_kode LIKE 'ADJ-%'
ORDER BY tgl_transaksi DESC;
```

### 4. Total yang Diharapkan
```sql
-- Total dari tabel Pengeluaran (seharusnya Rp 7.178.000)
SELECT 
    COUNT(*) as jumlah_transaksi,
    SUM(nominal) as total_nominal
FROM pengeluaran
WHERE YEAR(tgl_keluar) = 2024;

-- Total dari JurnalKas tanpa ADJ (seharusnya sama dengan atas)
SELECT 
    COUNT(*) as jumlah_transaksi,
    SUM(nominal) as total_nominal
FROM jurnal_kas
WHERE YEAR(tgl_transaksi) = 2024
  AND jenis = 'Keluar'
  AND referensi_kode NOT LIKE 'ADJ-%';
```

### 5. Cek Jurnal di 2026 (Harus Kosong)
```sql
SELECT 
    id,
    tgl_transaksi,
    jenis,
    nominal,
    referensi_kode,
    keterangan
FROM jurnal_kas
WHERE YEAR(tgl_transaksi) = 2026
  AND jenis = 'Keluar'
ORDER BY tgl_transaksi DESC;
```

---

## Kemungkinan Masalah

1. **ADJ journals masih terhitung** - Filter `NOT LIKE 'ADJ-%'` tidak bekerja
2. **Ada jurnal lain yang tidak terkait** - Mungkin ada transaksi "Keluar" lain di 2024
3. **Cache** - Server belum restart atau ada caching di browser

---

## Solusi Cepat

Jika ternyata ada ADJ journals yang masih terhitung, jalankan:

```sql
-- Hapus SEMUA ADJ journals (cleanup total)
DELETE FROM jurnal_kas
WHERE referensi_kode LIKE 'ADJ-%';
```

Lalu restart server dan refresh halaman.
