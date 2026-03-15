/**
 * Script Restore Database TPQ Futuhil Hidayah Wal Hikmah
 * Merestore database dari file backup SQL
 * 
 * Penggunaan:
 *   npm run db:restore
 *   node src/lib/restore.js
 *   node src/lib/restore.js backup_tpq_futuhil_2026-03-15T10-30-00.sql
 *   node src/lib/restore.js backup_tpq_futuhil_2026-03-15T10-30-00.sql.gz (compressed)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');
const dotenv = require('dotenv');
const zlib = require('zlib');

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

// Interface untuk input user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt untuk konfirmasi
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

// Dapatkan daftar file backup
function getBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ Folder backup tidak ditemukan!');
    return [];
  }
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && (f.endsWith('.sql') || f.endsWith('.sql.gz')))
    .sort()
    .reverse();
  
  return files;
}

// Decompress file gzip
function decompressFile(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath.endsWith('.gz')) {
      resolve(filePath);
      return;
    }
    
    console.log('🔄 Decompressing file...');
    const readStream = fs.createReadStream(filePath);
    const outputPath = filePath.slice(0, -3); // Remove .gz
    const writeStream = fs.createWriteStream(outputPath);
    
    readStream.pipe(zlib.createGunzip()).pipe(writeStream)
      .on('finish', () => {
        console.log(`✅ File didecompress: ${path.basename(outputPath)}`);
        resolve(outputPath);
      })
      .on('error', reject);
  });
}

// Restore dengan mysql command
function restoreWithMysql(inputFile) {
  return new Promise((resolve, reject) => {
    const sslOption = config.ssl ? '--ssl-mode=REQUIRED' : '';
    const command = `mysql -h ${config.host} -P ${config.port} -u ${config.user} -p"${config.password}" ${sslOption} "${config.database}" < "${inputFile}"`;
    
    console.log('🔄 Menggunakan mysql command...');
    console.log(`📝 Command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`mysql error: ${stderr || error.message}`));
      } else {
        console.log('✅ mysql restore berhasil!');
        resolve(true);
      }
    });
  });
}

// Restore manual menggunakan Sequelize
async function restoreManual(sqlFile) {
  console.log('🔄 Memulai restore manual...');
  
  const { sequelize } = require('./db');
  
  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil!');
    
    // Baca file SQL
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Pisahkan statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*') && !s.startsWith('SET FOREIGN_KEY_CHECKS'));
    
    console.log(`📊 Ditemukan ${statements.length} statements SQL`);
    console.log('');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Eksekusi setiap statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await sequelize.query(statement);
        successCount++;
        
        // Progress setiap 10 statements
        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${statements.length} statements...`);
        }
      } catch (error) {
        errorCount++;
        
        // Ignore error untuk DROP TABLE jika tabel tidak ada
        if (error.original && error.original.code === 'ER_CANT_FIND_FILE') {
          console.log(`   ⚠️ Warning: ${error.message}`);
        } else {
          console.log(`   ❌ Error pada statement ${i + 1}: ${error.message}`);
        }
      }
    }
    
    console.log('');
    console.log(`✅ Restore selesai: ${successCount} berhasil, ${errorCount} error`);
    
    await sequelize.close();
    
    return true;
  } catch (error) {
    console.error('❌ Error restore manual:', error);
    throw error;
  }
}

// Validasi file SQL
function validateSqlFile(filePath) {
  console.log('🔍 Memvalidasi file SQL...');
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check jika file kosong
  if (content.length === 0) {
    throw new Error('File SQL kosong!');
  }
  
  // Check jika file berisi SQL yang valid
  const hasCreateTable = content.includes('CREATE TABLE');
  const hasInsert = content.includes('INSERT INTO');
  const hasDropTable = content.includes('DROP TABLE');
  
  console.log(`   DROP TABLE: ${hasDropTable ? '✅' : '❌'}`);
  console.log(`   CREATE TABLE: ${hasCreateTable ? '✅' : '❌'}`);
  console.log(`   INSERT INTO: ${hasInsert ? '✅' : '❌'}`);
  
  if (!hasCreateTable && !hasInsert) {
    throw new Error('File SQL tidak berisi CREATE TABLE atau INSERT INTO!');
  }
  
  // Estimate jumlah data
  const insertCount = (content.match(/INSERT INTO/g) || []).length;
  console.log(`   Estimasi tabel: ${insertCount} tabel`);
  
  return true;
}

// Main function
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    RESTORE DATABASE TPQ Futuhil Hidayah Wal Hikmah    ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📁 Database: ${config.database}`);
  console.log(`🖥️ Host: ${config.host}:${config.port}`);
  console.log(`👤 User: ${config.user}`);
  console.log('');
  
  // Check argument command line
  let backupFile = process.argv[2];
  
  // Jika tidak ada argument, tampilkan daftar backup
  if (!backupFile) {
    const files = getBackupFiles();
    
    if (files.length === 0) {
      console.log('❌ Tidak ada file backup ditemukan!');
      console.log('');
      console.log('Letakkan file backup di folder:');
      console.log(`   ${BACKUP_DIR}`);
      console.log('');
      console.log('Format file: backup_tpq_futuhil_YYYY-MM-DDTHH-MM-SS.sql');
      console.log('');
      process.exit(1);
    }
    
    console.log('📂 Daftar file backup tersedia:');
    console.log('');
    
    files.forEach((file, index) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileSize = (stats.size / 1024 / 1024).toFixed(2);
      const date = stats.mtime.toLocaleString('id-ID');
      
      console.log(`   ${index + 1}. ${file}`);
      console.log(`      Ukuran: ${fileSize} MB | Tanggal: ${date}`);
      console.log('');
    });
    
    // Prompt user untuk memilih
    console.log('Pilih nomor backup yang akan direstore (atau ketik nama file):');
    const answer = await prompt('> ');
    
    if (!answer) {
      console.log('❌ Restore dibatalkan');
      process.exit(1);
    }
    
    // Check jika input adalah nomor
    const num = parseInt(answer);
    if (!isNaN(num) && num >= 1 && num <= files.length) {
      backupFile = files[num - 1];
    } else {
      backupFile = answer;
    }
  }
  
  // Resolve path file
  let filePath = path.join(BACKUP_DIR, backupFile);
  
  if (!fs.existsSync(filePath)) {
    // Coba cari di current directory
    if (fs.existsSync(backupFile)) {
      filePath = path.resolve(backupFile);
    } else {
      console.log(`❌ File tidak ditemukan: ${backupFile}`);
      process.exit(1);
    }
  }
  
  console.log(`📄 File backup: ${path.basename(filePath)}`);
  console.log('');
  
  // Decompress jika file .gz
  if (filePath.endsWith('.gz')) {
    filePath = await decompressFile(filePath);
  }
  
  // Validasi file
  try {
    validateSqlFile(filePath);
  } catch (error) {
    console.log(`❌ Validasi gagal: ${error.message}`);
    process.exit(1);
  }
  
  console.log('');
  console.log('⚠️  PERINGATAN PENTING! ⚠️');
  console.log('');
  console.log('   Restore akan:');
  console.log('   1. DROP semua tabel yang ada');
  console.log('   2. CREATE tabel baru');
  console.log('   3. INSERT semua data dari backup');
  console.log('');
  console.log('   ⚠️  SEMUA DATA SEKARANG AKAN HILANG!');
  console.log('');
  console.log('   Pastikan Anda sudah backup data terbaru sebelum restore!');
  console.log('');
  
  const confirm = await prompt('   Apakah Anda yakin ingin melanjutkan? (ketik "YA" untuk konfirmasi): ');
  
  if (confirm !== 'ya') {
    console.log('');
    console.log('❌ Restore dibatalkan');
    console.log('');
    process.exit(0);
  }
  
  console.log('');
  console.log('🔄 Memulai restore...');
  console.log('');
  
  try {
    // Coba restore dengan mysql command
    try {
      await restoreWithMysql(filePath);
    } catch (mysqlError) {
      console.log('⚠️ mysql command tidak tersedia, menggunakan restore manual...');
      console.log('');
      await restoreManual(filePath);
    }
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ RESTORE SELESAI                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 Silakan restart aplikasi untuk melihat perubahan.');
    console.log('');
    
    // Cleanup file decompressed jika perlu
    if (process.argv[2]?.endsWith('.gz') && fs.existsSync(filePath)) {
      const cleanup = await prompt('🗑️ Hapus file yang sudah didecompress? (y/n): ');
      if (cleanup === 'y') {
        fs.unlinkSync(filePath);
        console.log(`✅ File didecompress dihapus: ${path.basename(filePath)}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                   ❌ RESTORE GAGAL                     ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Error:', error.message);
    console.log('');
    console.log('Stack trace:');
    console.log(error.stack);
    console.log('');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run
main();
