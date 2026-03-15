/**
 * Script Backup Database TPQ Futuhil Hidayah Wal Hikmah
 * Menggunakan mysqldump untuk backup seluruh data dan tabel
 * Format: SQL
 * Output: src/backup/
 * 
 * Penggunaan:
 *   npm run db:backup
 *   node src/lib/backup.js
 *   node src/lib/backup.js --all (backup semua database)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
dotenv.config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

// Konfigurasi database dari environment
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tpq_futuhil',
  ssl: process.env.DB_SSL === 'true',
};

// Folder backup
const BACKUP_DIR = path.resolve(__dirname, '../backup');

// Pastikan folder backup ada
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 Folder backup dibuat: ${BACKUP_DIR}`);
}

// Generate nama file backup
function generateFilename() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `backup_${config.database}_${timestamp}.sql`;
}

// Escape string untuk SQL
function escapeString(str) {
  if (str === null || str === undefined) return 'NULL';
  return str.toString()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Format value untuk SQL
function formatValue(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  return `'${escapeString(value)}'`;
}

// Backup menggunakan mysqldump
function backupWithDump(outputFile) {
  return new Promise((resolve, reject) => {
    const sslOption = config.ssl ? '--ssl-mode=REQUIRED' : '';
    const command = `mysqldump -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${sslOption} --single-transaction --quick --lock-tables=false "${config.database}" > "${outputFile}"`;
    
    console.log('🔄 Menggunakan mysqldump...');
    console.log(`📝 Command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Jika mysqldump tidak tersedia, fallback ke manual backup
        if (error.code === 1 || stderr.includes('not found') || stderr.includes('recognized')) {
          console.log('⚠️ mysqldump tidak tersedia, menggunakan backup manual...');
          resolve(false);
        } else {
          reject(new Error(`mysqldump error: ${stderr || error.message}`));
        }
      } else {
        console.log('✅ mysqldump berhasil!');
        resolve(true);
      }
    });
  });
}

// Backup manual menggunakan Sequelize
async function backupManual(outputFile) {
  console.log('🔄 Memulai backup manual...');
  
  const sequelize = require('./db');
  const { QueryTypes } = require('sequelize');
  
  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil!');
    
    // Dapatkan semua tabel
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    
    console.log(`📊 Ditemukan ${tables.length} tabel: ${tables.join(', ')}`);
    
    let sqlContent = '';
    
    // Header
    sqlContent += `-- ============================================================\n`;
    sqlContent += `-- Backup Database: ${config.database}\n`;
    sqlContent += `-- Tanggal: ${new Date().toISOString()}\n`;
    sqlContent += `-- Host: ${config.host}\n`;
    sqlContent += `-- ============================================================\n\n`;
    
    // Disable foreign key checks
    sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
    
    // Backup setiap tabel
    for (const tableName of tables) {
      console.log(`📋 Backing up tabel: ${tableName}...`);
      
      // Dapatkan struktur tabel
      const tableStructure = await queryInterface.describeTable(tableName);
      
      // DROP TABLE IF EXISTS
      sqlContent += `-- --------------------------------------------------------\n`;
      sqlContent += `-- Tabel structure: ${tableName}\n`;
      sqlContent += `-- --------------------------------------------------------\n`;
      sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n\n`;
      
      // CREATE TABLE
      sqlContent += `CREATE TABLE \`${tableName}\` (\n`;
      const columns = [];
      const indexes = [];
      
      for (const [columnName, columnInfo] of Object.entries(tableStructure)) {
        let columnDef = `  \`${columnName}\` ${columnInfo.type.toUpperCase()}`;
        
        if (columnInfo.allowNull === false) {
          columnDef += ' NOT NULL';
        }
        
        if (columnInfo.defaultValue !== null && columnInfo.defaultValue !== undefined) {
          if (typeof columnInfo.defaultValue === 'string') {
            columnDef += ` DEFAULT '${escapeString(columnInfo.defaultValue)}'`;
          } else if (columnInfo.defaultValue !== 'CURRENT_TIMESTAMP') {
            columnDef += ` DEFAULT ${columnInfo.defaultValue}`;
          }
        }
        
        if (columnInfo.primaryKey) {
          columnDef += ' AUTO_INCREMENT';
        }
        
        columns.push(columnDef);
      }
      
      // Add primary key
      const primaryKey = Object.entries(tableStructure)
        .find(([_, info]) => info.primaryKey);
      if (primaryKey) {
        columns.push(`  PRIMARY KEY (\`${primaryKey[0]}\`)`);
      }
      
      sqlContent += columns.join(',\n');
      sqlContent += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
      
      // Backup data
      const [rows] = await sequelize.query(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        console.log(`   ↳ ${rows.length} rows`);
        
        sqlContent += `-- Data untuk tabel: ${tableName}\n`;
        
        const columns = Object.keys(rows[0]);
        sqlContent += `INSERT INTO \`${tableName}\` (${columns.map(col => `\`${col}\``).join(', ')}) VALUES\n`;
        
        const insertValues = rows.map(row => {
          const values = columns.map(col => formatValue(row[col]));
          return `  (${values.join(', ')})`;
        });
        
        sqlContent += insertValues.join(',\n');
        sqlContent += `;\n\n`;
      }
    }
    
    // Enable foreign key checks
    sqlContent += `SET FOREIGN_KEY_CHECKS = 1;\n\n`;
    
    // Footer
    sqlContent += `-- ============================================================\n`;
    sqlContent += `-- Backup selesai\n`;
    sqlContent += `-- ============================================================\n`;
    
    // Tulis ke file
    fs.writeFileSync(outputFile, sqlContent, 'utf8');
    
    console.log('✅ Backup manual berhasil!');
    
    await sequelize.close();
    
    return true;
  } catch (error) {
    console.error('❌ Error backup manual:', error);
    throw error;
  }
}

// Compress file dengan gzip
function compressFile(filePath) {
  return new Promise((resolve, reject) => {
    const zlib = require('zlib');
    const readStream = fs.createReadStream(filePath);
    const writeStream = fs.createWriteStream(`${filePath}.gz`);
    
    readStream.pipe(zlib.createGzip()).pipe(writeStream)
      .on('finish', () => {
        console.log(`✅ File dikompresi: ${path.basename(filePath)}.gz`);
        resolve();
      })
      .on('error', reject);
  });
}

// Hapus file backup lama (lebih dari 30 hari)
function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR);
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  let deletedCount = 0;
  
  for (const file of files) {
    if (!file.startsWith('backup_')) continue;
    
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtimeMs < thirtyDaysAgo) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`🗑️ Dihapus backup lama: ${file}`);
    }
  }
  
  if (deletedCount > 0) {
    console.log(`✅ Dibersihkan ${deletedCount} file backup lama`);
  }
}

// Main function
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     BACKUP DATABASE TPQ Futuhil Hidayah Wal Hikmah    ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📁 Database: ${config.database}`);
  console.log(`🖥️ Host: ${config.host}:${config.port}`);
  console.log(`👤 User: ${config.user}`);
  console.log('');
  
  const filename = generateFilename();
  const outputFile = path.join(BACKUP_DIR, filename);
  
  console.log(`📝 File backup: ${filename}`);
  console.log('');
  
  try {
    // Coba backup dengan mysqldump
    const usedDump = await backupWithDump(outputFile);
    
    // Jika mysqldump gagal/tidak tersedia, gunakan backup manual
    if (!usedDump) {
      await backupManual(outputFile);
    }
    
    // Get file size
    const stats = fs.statSync(outputFile);
    const fileSize = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`📦 Ukuran file: ${fileSize} MB`);
    
    // Compress file
    console.log('');
    console.log('🔄 Mengompresi file...');
    await compressFile(outputFile);
    
    // Cleanup old backups
    console.log('');
    console.log('🧹 Membersihkan backup lama...');
    cleanupOldBackups();
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ BACKUP SELESAI                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📂 Lokasi backup: ${BACKUP_DIR}`);
    console.log(`📄 File: ${filename}.gz`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ BACKUP GAGAL                     ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  }
}

// Run
main();
