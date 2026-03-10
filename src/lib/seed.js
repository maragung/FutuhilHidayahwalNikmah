const fs = require('fs');
const path = require('path');

// ─── Backup helper ────────────────────────────────────────────────────────────
// Ekspor semua tabel ke file JSON sebelum seed berjalan.
// File disimpan di <project-root>/backups/ dengan nama otomatis (timestamp).
// Jika nama sudah ada (sangat jarang), tambah _1, _2, dst.
async function backupDatabase(models) {
  const backupDir = path.resolve(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
  let backupPath = path.join(backupDir, `backup_before_seed_${ts}.json`);
  let counter = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = path.join(backupDir, `backup_before_seed_${ts}_${counter}.json`);
    counter++;
  }

  const data = {};
  for (const Model of models) {
    try {
      const rows = await Model.findAll({ raw: true });
      data[Model.getTableName ? Model.getTableName() : Model.tableName] = rows;
    } catch (e) {
      data[Model.name || 'unknown'] = `[error: ${e.message}]`;
    }
  }

  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');
  return backupPath;
}
// ──────────────────────────────────────────────────────────────────────────────
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });
const {
  sequelize,
  Admin,
  Role,
  Santri,
  PembayaranSPP,
  InfakSedekah,
  Pengeluaran,
  JurnalKas,
  Backup,
  Saran,
  Pengaturan,
  Kegiatan,
  PembayaranLain,
  BukuPrestasiSantri,
  Absensi,
  EmailServer,
  EmailLog,
  Log,
} = require('./models');

const ROLES_DEFAULT = [
  { id: 6, nama_role: 'Developer',    level: 0, is_system: true, deskripsi: 'Developer / Super Admin – akses penuh termasuk kelola Pimpinan', akses_default: null },
  { id: 1, nama_role: 'Pimpinan TPQ', level: 1, is_system: true, deskripsi: 'Pimpinan / Kepala TPQ – akses penuh', akses_default: null },
  { id: 2, nama_role: 'Sekretaris',   level: 2, is_system: true, deskripsi: 'Sekretaris – kelola santri & laporan', akses_default: ['dashboard','santri','tambah_santri','bayar','pembayaran_lain','laporan','jurnal','saran','notifikasi','prestasi_santri','export_database'] },
  { id: 3, nama_role: 'Bendahara',    level: 3, is_system: true, deskripsi: 'Bendahara – kelola keuangan', akses_default: ['dashboard','santri','bayar','pembayaran_lain','infak','pengeluaran','dana','jurnal','laporan','pengaturan','notifikasi','prestasi_santri','export_database'] },
  { id: 4, nama_role: 'Pengajar',     level: 4, is_system: true, deskripsi: 'Pengajar / Ustadz – akses terbatas', akses_default: ['santri','prestasi_santri','laporan','saran','notifikasi','akun'] },
  { id: 5, nama_role: 'Lainnya',      level: 5, is_system: true, deskripsi: 'Role lainnya – akses terbatas', akses_default: ['dashboard'] },
];

async function seed() {
  const t = await sequelize.transaction();
  try {
    console.log('🔄 Menjalankan seed minimal (reset data)...');
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil');

    // ── Backup sebelum reset ─────────────────────────────────────────────────
    console.log('💾 Membuat backup database sebelum seed...');
    const allModels = [
      Role, Admin, Santri, PembayaranSPP, PembayaranLain, InfakSedekah,
      Pengeluaran, JurnalKas, Backup, Saran, Pengaturan, Kegiatan,
      BukuPrestasiSantri, Absensi, EmailServer, EmailLog, Log,
    ];
    const backupFile = await backupDatabase(allModels);
    console.log(`✅ Backup tersimpan: ${backupFile}`);
    // ────────────────────────────────────────────────────────────────────────

    // Disable foreign key checks to allow truncation
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });

    await EmailLog.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await EmailServer.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await BukuPrestasiSantri.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Absensi.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await PembayaranLain.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await PembayaranSPP.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await InfakSedekah.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Pengeluaran.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await JurnalKas.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Backup.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Saran.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Kegiatan.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Log.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Santri.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Pengaturan.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Admin.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Role.destroy({ where: {}, truncate: true, force: true, transaction: t });

    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });

    // Buat default roles
    for (const role of ROLES_DEFAULT) {
      await Role.create(role, { transaction: t });
    }

    const admin = await Admin.create({
      nama_lengkap: 'Developer',
      jabatan: 'Developer',
      role_id: 6,
      username: 'developer',
      email: 'gmaragung@gmail.com',
      password: 'admin123456789',
      pin: '123456',
      is_active: true,
    }, { transaction: t });

    await t.commit();

    console.log('✅ Seed selesai: Developer, Pimpinan TPQ, Sekretaris, Bendahara, Pengajar, Lainnya');
    console.log('✅ Admin dibuat:');
    console.log(`   ID       : ${admin.id}`);
    console.log('   Username : developer');
    console.log('   Jabatan  : Developer (Super Admin)');
    console.log('   Email    : gmaragung@gmail.com');
    console.log('   Password : admin123456789');
    console.log('   PIN      : 123456  (per-akun — ubah via halaman Akun setelah login)');

    process.exit(0);
  } catch (error) {
    await t.rollback();
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();
