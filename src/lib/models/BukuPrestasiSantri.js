const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const BukuPrestasiSantri = sequelize.define('BukuPrestasiSantri', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  santri_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'santri', key: 'id' },
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'admins', key: 'id' },
    comment: 'Admin/Pengajar yang mencatat buku prestasi',
  },
  tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  jenis_prestasi: {
    type: DataTypes.ENUM('surat_doa', 'halaman'),
    allowNull: false,
  },
  judul_prestasi: {
    type: DataTypes.STRING(150),
    allowNull: true,
    comment: 'Nama surat pendek / doa harian',
  },
  jilid: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Snapshot jilid saat prestasi dicatat',
  },
  halaman: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  ust_nama: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  paraf: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  keterangan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'buku_prestasi_santri',
  indexes: [
    { fields: ['santri_id'] },
    { fields: ['admin_id'] },
    { fields: ['tanggal'] },
    { fields: ['jenis_prestasi'] },
  ],
});

module.exports = BukuPrestasiSantri;