const fs = require('fs');
const path = require('path');
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
} = require('./models');

const ROLES_DEFAULT = [
  { id: 1, nama_role: 'Pimpinan TPQ', level: 1, is_system: true, deskripsi: 'Pimpinan / Kepala TPQ – akses penuh' },
  { id: 2, nama_role: 'Sekretaris',   level: 2, is_system: true, deskripsi: 'Sekretaris – kelola santri & laporan' },
  { id: 3, nama_role: 'Bendahara',    level: 3, is_system: true, deskripsi: 'Bendahara – kelola keuangan' },
  { id: 4, nama_role: 'Pengajar',     level: 4, is_system: true, deskripsi: 'Pengajar / Ustadz – akses terbatas' },
  { id: 5, nama_role: 'Lainnya',      level: 5, is_system: true, deskripsi: 'Role lainnya – akses terbatas' },
];

async function seed() {
  const t = await sequelize.transaction();
  try {
    console.log('🔄 Menjalankan seed minimal (reset data)...');
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil');

    // Disable foreign key checks to allow truncation
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });

    await PembayaranLain.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await PembayaranSPP.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await InfakSedekah.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Pengeluaran.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await JurnalKas.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Backup.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Saran.destroy({ where: {}, truncate: true, force: true, transaction: t });
    await Kegiatan.destroy({ where: {}, truncate: true, force: true, transaction: t });
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
      jabatan: 'Pimpinan TPQ',
      role_id: 1,
      username: 'developer',
      email: 'gmaragung@gmail.com',
      password: 'admin123456789',
      pin: '123456',
      is_active: true,
    }, { transaction: t });

    await t.commit();

    console.log('✅ Seed selesai: semua tabel dikosongkan');
    console.log('✅ Roles dibuat: Pimpinan TPQ, Sekretaris, Bendahara, Pengajar, Lainnya');
    console.log('✅ Admin dibuat:');
    console.log(`   ID       : ${admin.id}`);
    console.log('   Username : developer');
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
