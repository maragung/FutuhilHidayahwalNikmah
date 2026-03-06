const sequelize = require('../db');
const Admin = require('./Admin');
const Role = require('./Role');
const Santri = require('./Santri');
const PembayaranSPP = require('./PembayaranSPP');
const InfakSedekah = require('./InfakSedekah');
const Pengeluaran = require('./Pengeluaran');
const JurnalKas = require('./JurnalKas');
const Backup = require('./Backup');
const Saran = require('./Saran');
const Pengaturan = require('./Pengaturan');
const Kegiatan = require('./Kegiatan');
const PembayaranLain = require('./PembayaranLain');
const Log = require('./Log');

// Relasi Role
Role.hasMany(Admin, { foreignKey: 'role_id', as: 'admins' });
Admin.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Relasi Admin
Admin.hasMany(PembayaranSPP, { foreignKey: 'admin_id', as: 'pembayaran' });
Admin.hasMany(InfakSedekah, { foreignKey: 'admin_id', as: 'infak' });
Admin.hasMany(Pengeluaran, { foreignKey: 'admin_id', as: 'pengeluaran' });
Admin.hasMany(JurnalKas, { foreignKey: 'admin_id', as: 'jurnal' });
Admin.hasMany(Backup, { foreignKey: 'admin_id', as: 'backup' });
Admin.hasMany(Saran, { foreignKey: 'admin_id', as: 'saran' });
Admin.hasMany(Kegiatan, { foreignKey: 'admin_id', as: 'kegiatan' });
Admin.hasMany(PembayaranLain, { foreignKey: 'admin_id', as: 'pembayaranLain' });

// Relasi Santri
Santri.hasMany(PembayaranSPP, { foreignKey: 'santri_id', as: 'pembayaran' });
Santri.hasMany(PembayaranLain, { foreignKey: 'santri_id', as: 'pembayaranLain' });

// Relasi PembayaranSPP
PembayaranSPP.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });
PembayaranSPP.belongsTo(Santri, { foreignKey: 'santri_id', as: 'santri' });

// Relasi InfakSedekah
InfakSedekah.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// Relasi Pengeluaran
Pengeluaran.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// Relasi JurnalKas
JurnalKas.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// Relasi Backup
Backup.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// Relasi Saran
Saran.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// Relasi Kegiatan
Kegiatan.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });
Kegiatan.hasMany(PembayaranLain, { foreignKey: 'kegiatan_id', as: 'pembayaran' });

// Relasi PembayaranLain
PembayaranLain.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });
PembayaranLain.belongsTo(Santri, { foreignKey: 'santri_id', as: 'santri' });
PembayaranLain.belongsTo(Kegiatan, { foreignKey: 'kegiatan_id', as: 'kegiatan' });

module.exports = {
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
  Log,
};
