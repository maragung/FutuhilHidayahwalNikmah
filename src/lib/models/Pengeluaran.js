const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Pengeluaran = sequelize.define('Pengeluaran', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  kode_pengeluaran: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  judul: {
    type: DataTypes.STRING(150),
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
  tgl_keluar: {
    type: DataTypes.DATEONLY,
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
  kategori: {
    type: DataTypes.ENUM('Gaji', 'Listrik', 'Sarana', 'Pembangunan', 'ATK', 'Lainnya'),
    allowNull: false,
    defaultValue: 'Lainnya',
  },
}, {
  tableName: 'pengeluaran',
});

module.exports = Pengeluaran;
