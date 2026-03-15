/**
 * Migration script untuk menghapus kolom nominal_wajib dari tabel pembayaran_spp
 * Jalankan: npm run db:remove-nominal-wajib
 */

const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

const { sequelize } = require('./models');

async function migrateRemoveNominalWajib() {
  try {
    console.log('🔄 Menghapus kolom nominal_wajib dari tabel pembayaran_spp...');

    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil!');

    const queryInterface = sequelize.getQueryInterface();
    
    // Cek apakah tabel pembayaran_spp ada
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(t => typeof t === 'string' ? t : t.tableName || Object.values(t)[0]);
    
    if (!tableNames.includes('pembayaran_spp')) {
      console.log('❌ Tabel pembayaran_spp belum ada!');
      process.exit(1);
    }

    const columns = await queryInterface.describeTable('pembayaran_spp');
    
    // Hapus kolom nominal_wajib jika ada
    if (columns.nominal_wajib) {
      console.log('➖ Menghapus kolom nominal_wajib...');
      await queryInterface.removeColumn('pembayaran_spp', 'nominal_wajib');
      console.log('✅ Kolom nominal_wajib berhasil dihapus!');
    } else {
      console.log('✓ Kolom nominal_wajib sudah tidak ada');
    }

    console.log('\n✅ Migration selesai!');
    console.log('\n📋 Struktur tabel pembayaran_spp sekarang:');
    console.log('   • id (PRIMARY KEY)');
    console.log('   • kode_invoice (UNIQUE)');
    console.log('   • santri_id (FOREIGN KEY → santri)');
    console.log('   • admin_id (FOREIGN KEY → admins)');
    console.log('   • tgl_bayar (DATETIME)');
    console.log('   • bulan_spp (TINYINT)');
    console.log('   • tahun_spp (INT)');
    console.log('   • nominal (DECIMAL) - Nominal yang dibayarkan');
    console.log('   • status_bayar (ENUM: lunas, belum_lunas)');
    console.log('   • metode_bayar (ENUM: Tunai, Transfer, Belum Lunas)');
    console.log('   • keterangan (TEXT)');
    console.log('   • created_at, updated_at, deleted_at');
    
  } catch (error) {
    console.error('❌ Error migration:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrateRemoveNominalWajib();
