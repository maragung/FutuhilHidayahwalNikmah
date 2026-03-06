const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Santri = sequelize.define('Santri', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  no_absen: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: 'Nomor absen santri',
  },
  nik: {
    type: DataTypes.STRING(16),
    allowNull: false,
    unique: true,
  },
  nama_lengkap: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  jilid: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Jilid 1',
  },
  alamat: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  nama_wali: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  no_telp_wali: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  email_wali: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  tgl_mendaftar: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  status_aktif: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_subsidi: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  tgl_nonaktif: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, {
  tableName: 'santri',
});

module.exports = Santri;
