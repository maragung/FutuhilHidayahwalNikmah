const fs = require('fs');
const path = require('path');

const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

const { sequelize } = require('./models');

const REQUIRED_COLUMNS = ['created_at', 'updated_at', 'deleted_at'];

function normalizeTableName(table) {
  if (typeof table === 'string') return table;
  if (table && typeof table === 'object') {
    if (table.tableName) return table.tableName;
    const values = Object.values(table);
    return typeof values[0] === 'string' ? values[0] : null;
  }
  return null;
}

async function run() {
  try {
    console.log('🔎 Memeriksa kolom audit di seluruh tabel...');
    await sequelize.authenticate();
    console.log('✅ Koneksi database OK');

    const queryInterface = sequelize.getQueryInterface();
    const rawTables = await queryInterface.showAllTables();
    const tableNames = rawTables.map(normalizeTableName).filter(Boolean).sort((a, b) => a.localeCompare(b));

    const missingByTable = [];

    for (const tableName of tableNames) {
      let columns;
      try {
        columns = await queryInterface.describeTable(tableName);
      } catch (error) {
        missingByTable.push({ tableName, missing: ['<gagal baca struktur tabel>'], error: error.message });
        continue;
      }

      const missing = REQUIRED_COLUMNS.filter((col) => !columns[col]);
      if (missing.length > 0) {
        missingByTable.push({ tableName, missing });
      }
    }

    console.log('');
    console.log(`📊 Total tabel diperiksa: ${tableNames.length}`);

    if (missingByTable.length === 0) {
      console.log('✅ Semua tabel sudah memiliki created_at, updated_at, deleted_at');
      process.exit(0);
      return;
    }

    console.log(`❌ Tabel yang belum lengkap: ${missingByTable.length}`);
    for (const item of missingByTable) {
      console.log(`- ${item.tableName}: ${item.missing.join(', ')}`);
      if (item.error) {
        console.log(`  alasan: ${item.error}`);
      }
    }

    process.exit(1);
  } catch (error) {
    console.error('❌ Gagal verifikasi audit columns:', error.message);
    process.exit(1);
  }
}

run();
