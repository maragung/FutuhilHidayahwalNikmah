const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });
const { Op } = require('sequelize');
const { sequelize, Admin, Role, Santri, PembayaranSPP, InfakSedekah, Pengeluaran, JurnalKas, Backup, Saran, Pengaturan, Kegiatan, PembayaranLain, Log } = require('./models');

const ROLES_DEFAULT = [
  { id: 1, nama_role: 'Pimpinan TPQ', level: 1, is_system: true, deskripsi: 'Pimpinan / Kepala TPQ – akses penuh', akses_default: null },
  { id: 2, nama_role: 'Sekretaris',   level: 2, is_system: true, deskripsi: 'Sekretaris – kelola santri & laporan', akses_default: JSON.stringify(['dashboard','santri','tambah_santri','bayar','pembayaran_lain','laporan','jurnal','saran','export_database']) },
  { id: 3, nama_role: 'Bendahara',    level: 3, is_system: true, deskripsi: 'Bendahara – kelola keuangan',          akses_default: JSON.stringify(['dashboard','santri','bayar','pembayaran_lain','infak','pengeluaran','dana','jurnal','laporan','pengaturan','export_database']) },
  { id: 4, nama_role: 'Pengajar',     level: 4, is_system: true, deskripsi: 'Pengajar / Ustadz – akses terbatas',  akses_default: JSON.stringify(['dashboard','santri','bayar','saran']) },
  { id: 5, nama_role: 'Lainnya',      level: 5, is_system: true, deskripsi: 'Role lainnya – akses terbatas',       akses_default: JSON.stringify(['dashboard']) },
];

async function migrate() {
  try {
    console.log('🔄 Memulai migrasi database...');

    // Test koneksi
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil!');

    // Sync semua model (buat tabel)
    await sequelize.sync({ alter: true });
    console.log('✅ Semua tabel berhasil dibuat/diupdate!');

    // Seed roles default
    const roleCount = await Role.count();
    if (roleCount === 0) {
      for (const role of ROLES_DEFAULT) {
        await Role.create(role);
      }
      console.log('✅ Role default berhasil dibuat!');
    }

    // Cek apakah admin sudah ada
    const adminCount = await Admin.count();
    if (adminCount === 0) {
      // Buat admin default
      await Admin.create({
        nama_lengkap: 'Pimpinan TPQ',
        jabatan: 'Pimpinan TPQ',
        role_id: 1,
        username: 'pimpinan',
        email: 'maragung@outlook.com',
        password: 'admin123456789',
        pin: '123456',
      });
      console.log('✅ Admin default berhasil dibuat!');
      console.log('   Email: maragung@outlook.com');
      console.log('   Password: admin123456789');
      console.log('   PIN: 123456  (per-akun — ubah via halaman Akun setelah login)');
    } else {
      const pimpinan = await Admin.findOne({ where: { jabatan: 'Pimpinan TPQ' } });
      if (pimpinan && !pimpinan.username) {
        await pimpinan.update({ username: 'pimpinan' });
        console.log('✅ Username default untuk Pimpinan TPQ diset: pimpinan');
      }

      const adminsMissingUsername = await Admin.findAll({
        where: {
          [Op.or]: [{ username: null }, { username: '' }],
        },
      });
      if (adminsMissingUsername.length > 0) {
        for (const admin of adminsMissingUsername) {
          const emailLocal = (admin.email || '').split('@')[0];
          let base = emailLocal || `user${admin.id}`;
          base = base.toLowerCase().replace(/[^a-z0-9._-]/g, '.').replace(/\.+/g, '.');
          base = base.replace(/^\.+|\.+$/g, '');
          if (base.length < 3) base = `user${admin.id}`;
          if (base.length > 45) base = base.slice(0, 45);

          let candidate = base;
          let suffix = 1;
          while (await Admin.count({ where: { username: candidate } })) {
            candidate = `${base}${suffix}`;
            if (candidate.length > 50) {
              candidate = candidate.slice(0, 50 - String(suffix).length) + suffix;
            }
            suffix += 1;
          }

          await admin.update({ username: candidate });
          console.log(`✅ Username diset untuk ${admin.email}: ${candidate}`);
        }
      }
    }

    // Buat pengaturan default
    const settingsCount = await Pengaturan.count();

    // Set terima_email_perubahan = true hanya untuk admin yang belum punya nilai (NULL)
    const [affectedRows] = await Admin.update(
      { terima_email_perubahan: true },
      { where: { terima_email_perubahan: null } }
    );
    if (affectedRows > 0) {
      console.log(`✅ ${affectedRows} admin di-set terima_email_perubahan = true (default)`);
    }

    // Pastikan setiap admin punya PIN (PIN per-akun, default 123456)
    const adminsMissingPin = await Admin.findAll({ where: { pin: null } });
    if (adminsMissingPin.length > 0) {
      for (const admin of adminsMissingPin) {
        admin.pin = '123456';
        await admin.save();
        console.log(`✅ PIN default (123456) diset untuk akun: ${admin.username || admin.email}`);
      }
      console.log(`   ⚠️  ${adminsMissingPin.length} akun mendapat PIN default 123456 — harap ubah via halaman Akun`);
    }

    if (settingsCount === 0) {
      await Pengaturan.bulkCreate([
        { kunci: 'nama_tpq', nilai: 'TPQ Futuhil Hidayah Wal Hikmah', keterangan: 'Nama TPQ' },
        { kunci: 'nominal_spp_non_subsidi', nilai: '40000', keterangan: 'Nominal SPP non subsidi (Rp)' },
        { kunci: 'nominal_spp_subsidi', nilai: '30000', keterangan: 'Nominal SPP subsidi (Rp)' },
        { kunci: 'warna_non_subsidi', nilai: '#04B816', keterangan: 'Warna audit santri non subsidi' },
        { kunci: 'warna_subsidi', nilai: '#045EB8', keterangan: 'Warna audit santri subsidi' },
        { kunci: 'tahun_mulai_pembukuan', nilai: String(new Date().getFullYear()), keterangan: 'Tahun mulai pembukuan' },
        { kunci: 'alamat_tpq', nilai: '', keterangan: 'Alamat TPQ' },
        { kunci: 'no_telp_tpq', nilai: '', keterangan: 'Nomor telepon TPQ' },
        { kunci: 'smtp_host', nilai: '', keterangan: 'SMTP Host (opsional, override env var GMAIL_SMTP_HOST)' },
        { kunci: 'smtp_port', nilai: '', keterangan: 'SMTP Port (opsional, override env var GMAIL_SMTP_PORT)' },
      ]);
      console.log('✅ Pengaturan default berhasil dibuat!');
    } else {
      // Pastikan setting SMTP host/port tersedia untuk instalasi lama (kredensial dari env saja)
      const smtpKeys = ['smtp_host', 'smtp_port'];
      for (const kunci of smtpKeys) {
        const exists = await Pengaturan.findOne({ where: { kunci } });
        if (!exists) {
          await Pengaturan.create({ kunci, nilai: '', keterangan: `SMTP override: ${kunci}` });
        }
      }
      console.log('✅ Setting SMTP dipastikan tersedia');
    }
    
    console.log('');
    console.log('🎉 Migrasi database selesai!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrasi:', error.message);
    process.exit(1);
  }
}

migrate();
