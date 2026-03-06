const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Saran = sequelize.define('Saran', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nama_pengirim: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email_pengirim: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  no_telp_pengirim: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  kategori: {
    type: DataTypes.ENUM('Saran', 'Kritik', 'Pertanyaan', 'Lainnya'),
    allowNull: false,
    defaultValue: 'Saran',
  },
  isi_saran: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Belum Dibaca', 'Sudah Dibaca', 'Ditindaklanjuti'),
    allowNull: false,
    defaultValue: 'Belum Dibaca',
  },
  tanggapan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'id',
    },
  },
}, {
  tableName: 'saran',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Saran;
