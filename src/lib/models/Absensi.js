const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Absensi = sequelize.define('Absensi', {
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
    comment: 'Admin/Pengajar yang mencatat absensi',
  },
  tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('hadir', 'sakit', 'izin', 'alpha'),
    allowNull: false,
    defaultValue: 'hadir',
  },
  catatan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'absensi',
  indexes: [
    {
      unique: true,
      fields: ['santri_id', 'tanggal'],
      name: 'uq_absensi_santri_tanggal',
    },
    {
      fields: ['tanggal'],
    },
    {
      fields: ['admin_id'],
    },
  ],
});

module.exports = Absensi;
