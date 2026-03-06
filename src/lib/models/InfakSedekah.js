const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const InfakSedekah = sequelize.define('InfakSedekah', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  kode_transaksi: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  nama_donatur: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  nominal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  catatan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tgl_terima: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
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
  tableName: 'infak_sedekah',
});

module.exports = InfakSedekah;
