const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Kegiatan = sequelize.define('Kegiatan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nama_kegiatan: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  nominal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  keterangan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  gabung_saldo_utama: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'id',
    },
  },
}, {
  tableName: 'kegiatan',
});

module.exports = Kegiatan;
