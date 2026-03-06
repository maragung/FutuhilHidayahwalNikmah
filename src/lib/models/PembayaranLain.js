const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const PembayaranLain = sequelize.define('PembayaranLain', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  kode_invoice: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  santri_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'santri',
      key: 'id',
    },
  },
  kegiatan_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'kegiatan',
      key: 'id',
    },
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'id',
    },
  },
  nominal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  tgl_bayar: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  metode_bayar: {
    type: DataTypes.ENUM('Tunai', 'Transfer'),
    allowNull: false,
    defaultValue: 'Tunai',
  },
  keterangan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'pembayaran_lain',
});

module.exports = PembayaranLain;
