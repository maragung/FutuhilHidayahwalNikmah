-- Migration script to fix referensi_kode column length in jurnal_kas table
-- Run this SQL directly on your MySQL database to fix the edit pengeluaran error
-- 
-- Usage: 
--   mysql -u username -p database_name < fix-referensi-kode.sql
--   OR run via phpMyAdmin / MySQL Workbench

-- Change referensi_kode column from VARCHAR(20) to VARCHAR(50)
ALTER TABLE jurnal_kas 
MODIFY COLUMN referensi_kode VARCHAR(50) NOT NULL;

-- Verify the change
DESCRIBE jurnal_kas;

-- Optional: Check existing records with long referensi_kode
SELECT id, referensi_kode, LENGTH(referensi_kode) as kode_length 
FROM jurnal_kas 
WHERE LENGTH(referensi_kode) > 20 
ORDER BY LENGTH(referensi_kode) DESC;
