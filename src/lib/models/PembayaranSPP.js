const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const PembayaranSPP = sequelize.define('PembayaranSPP', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  kode_invoice: {
    type: DataTypes.STRING(20),
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
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'id',
    },
  },
  tgl_bayar: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  bulan_spp: {
    type: DataTypes.TINYINT,
    allowNull: false,
    validate: {
      min: 1,
      max: 12,
    },
  },
  tahun_spp: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nominal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Nominal yang dibayarkan',
  },
  status_bayar: {
    type: DataTypes.ENUM('lunas', 'belum_lunas'),
    allowNull: false,
    defaultValue: 'lunas',
    comment: 'lunas = sudah bayar penuh, belum_lunas = bayar parsial',
  },
  metode_bayar: {
    type: DataTypes.ENUM('Tunai', 'Transfer', 'Belum Lunas'),
    allowNull: false,
    defaultValue: 'Tunai',
  },
  keterangan: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'pembayaran_spp',
  timestamps: true,
  paranoid: false,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  indexes: [
    {
      unique: true,
      name: 'uniq_spp_santri_periode',
      fields: ['santri_id', 'tahun_spp', 'bulan_spp'],
    },
    {
      name: 'idx_spp_tahun_bulan',
      fields: ['tahun_spp', 'bulan_spp'],
    },
    {
      name: 'idx_spp_santri_tanggal',
      fields: ['santri_id', 'tgl_bayar'],
    },
  ],
});

module.exports = PembayaranSPP;
