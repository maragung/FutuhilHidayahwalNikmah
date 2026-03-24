# Fix Pengeluaran Edit Error

## Problem
When editing expenses (pengeluaran), the API returns error:
```
"Terjadi kesalahan server: Data too long for column 'referensi_kode' at row 1"
```

## Root Cause
The `referensi_kode` column in the `jurnal_kas` table was VARCHAR(20), but the generated reference code `ADJ-{kode_pengeluaran}` can exceed 20 characters.

## Solution

### 1. Model Updated ✅
The JurnalKas model has been updated to use VARCHAR(50) instead of VARCHAR(20).

### 2. Database Migration Completed ✅
The migration has been successfully run. The `referensi_kode` column is now VARCHAR(50).

### 3. Code Changes ✅
The API code now uses `buildSafeJurnalRef()` function that:
- Generates reference codes up to 50 characters
- Falls back to ID-based codes if the original is too long
- Safely truncates to fit within the column limit

## Files Changed
- `src/lib/models/JurnalKas.js` - Updated column type to VARCHAR(50)
- `src/lib/utils.js` - Added `buildSafeJurnalRef()` function
- `src/app/api/pengeluaran/[id]/route.js` - Uses the new safe reference function
- `src/lib/migrations/fix-referensi-kode-migration.js` - Migration script (NEW)
- `src/lib/migrations/fix-referensi-kode.sql` - SQL migration script (NEW)
- `.env.local` - Updated DB_SSL=true for Aiven Cloud connection
- `.env.example` - Updated documentation

## Testing
Now you can test the fix:
1. Push changes to GitHub (will deploy to Vercel)
2. Go to the pengeluaran page
3. Click on any expense to view details
4. Click "Edit" button
5. Modify the data and enter your PIN
6. Click "Simpan"
7. The edit should now work without errors!

## Migration Commands (Already Run ✅)

### Option A: Run via Node.js
```bash
cd d:\git\tpq\FutuhilHidayahwalNikmah
node src/lib/migrations/fix-referensi-kode-migration.js
```

### Option B: Run SQL directly
```bash
mysql -u username -p database_name < src/lib/migrations/fix-referensi-kode.sql
```

Or run the SQL directly via phpMyAdmin / MySQL Workbench:
```sql
ALTER TABLE jurnal_kas 
MODIFY COLUMN referensi_kode VARCHAR(50) NOT NULL;
```

## Additional Notes
- The migration has been run successfully on the production database
- SSL is now enabled for database connections (required for Aiven Cloud)
- The fix also applies to delete operations
