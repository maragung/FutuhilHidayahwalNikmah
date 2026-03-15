/**
 * Migration script untuk menambahkan kolom pembayaran parsial di tabel pembayaran_spp
 * Jalankan: npm run db:migrate:pembayaran-parsial
 */

const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

const { sequelize } = require('./models');
const { DataTypes } = require('sequelize');

async function migratePembayaranParsial() {
  try {
    console.log('🔄 Migrasi tabel pembayaran_spp untuk pembayaran parsial...');

    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil!');

    const queryInterface = sequelize.getQueryInterface();
    
    // Cek apakah tabel pembayaran_spp ada
    const tables = await queryInterface.showAllTables();
    const tableNames = tables.map(t => typeof t === 'string' ? t : t.tableName || Object.values(t)[0]);
    
    if (!tableNames.includes('pembayaran_spp')) {
      console.log('❌ Tabel pembayaran_spp belum ada. Jalankan db:migrate terlebih dahulu.');
      process.exit(1);
    }

    const columns = await queryInterface.describeTable('pembayaran_spp');
    
    // Tambah kolom nominal_wajib jika belum ada
    if (!columns.nominal_wajib) {
      console.log('➕ Menambahkan kolom nominal_wajib...');
      await queryInterface.addColumn('pembayaran_spp', 'nominal_wajib', {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'Nominal wajib per bulan (untuk tracking apakah sudah lunas atau belum)',
      });
      console.log('✅ Kolom nominal_wajib berhasil ditambahkan!');
    } else {
      console.log('✓ Kolom nominal_wajib sudah ada');
    }

    // Tambah kolom status_bayar jika belum ada
    if (!columns.status_bayar) {
      console.log('➕ Menambahkan kolom status_bayar...');
      await queryInterface.addColumn('pembayaran_spp', 'status_bayar', {
        type: DataTypes.ENUM('lunas', 'belum_lunas'),
        allowNull: false,
        defaultValue: 'lunas',
        comment: 'lunas = sudah bayar penuh, belum_lunas = bayar parsial',
      });
      console.log('✅ Kolom status_bayar berhasil ditambahkan!');
    } else {
      console.log('✓ Kolom status_bayar sudah ada');
    }

    // Update kolom metode_bayar untuk menambahkan enum 'Belum Lunas'
    if (columns.metode_bayar) {
      console.log('🔄 Updating kolom metode_bayar untuk menambahkan enum "Belum Lunas"...');
      await sequelize.query(`
        ALTER TABLE pembayaran_spp 
        MODIFY COLUMN metode_bayar ENUM('Tunai', 'Transfer', 'Belum Lunas') NOT NULL DEFAULT 'Tunai'
      `);
      console.log('✅ Kolom metode_bayar berhasil diupdate!');
    }

    // Update comment pada kolom nominal
    console.log('📝 Updating comment kolom nominal...');
    await sequelize.query(`
      ALTER TABLE pembayaran_spp 
      MODIFY COLUMN nominal DECIMAL(15,2) NOT NULL 
      COMMENT 'Nominal yang dibayarkan (bisa kurang dari nominal_wajib untuk pembayaran parsial)'
    `);
    console.log('✅ Kolom nominal berhasil diupdate!');

    console.log('\n✅ Tabel pembayaran_spp berhasil dimigrasi!');
    console.log('\n📋 Struktur tabel pembayaran_spp sekarang:');
    console.log('   • id (PRIMARY KEY)');
    console.log('   • kode_invoice (UNIQUE)');
    console.log('   • santri_id (FOREIGN KEY → santri)');
    console.log('   • admin_id (FOREIGN KEY → admins)');
    console.log('   • tgl_bayar (DATETIME)');
    console.log('   • bulan_spp (TINYINT)');
    console.log('   • tahun_spp (INT)');
    console.log('   • nominal (DECIMAL) - Nominal yang dibayarkan');
    console.log('   • nominal_wajib (DECIMAL) - Nominal wajib per bulan');
    console.log('   • status_bayar (ENUM: lunas, belum_lunas)');
    console.log('   • metode_bayar (ENUM: Tunai, Transfer, Belum Lunas)');
    console.log('   • keterangan (TEXT)');
    console.log('   • created_at, updated_at, deleted_at');
    
  } catch (error) {
    console.error('❌ Error migrasi:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migratePembayaranParsial();
