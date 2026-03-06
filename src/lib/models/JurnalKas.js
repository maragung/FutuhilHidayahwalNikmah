const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const JurnalKas = sequelize.define('JurnalKas', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tgl_transaksi: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  jenis: {
    type: DataTypes.ENUM('Masuk', 'Keluar'),
    allowNull: false,
  },
  nominal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  referensi_kode: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  keterangan: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  saldo_berjalan: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
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
  tableName: 'jurnal_kas',
});

module.exports = JurnalKas;
