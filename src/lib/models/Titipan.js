const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Titipan = sequelize.define('Titipan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  santri_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'santri',
      key: 'id',
    },
  },
  nominal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  tanggal: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  keterangan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('aktif', 'digunakan', 'dihapus'),
    allowNull: false,
    defaultValue: 'aktif',
  },
}, {
  tableName: 'titipan',
  timestamps: true,
  paranoid: false,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
});

module.exports = Titipan;
