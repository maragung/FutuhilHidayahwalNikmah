const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EmailServer = sequelize.define('EmailServer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nama: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nama friendly, misal "Gmail Utama", "Outlook Cadangan"',
  },
  tipe: {
    type: DataTypes.ENUM('primary', 'backup'),
    allowNull: false,
    defaultValue: 'primary',
  },
  smtp_host: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'misal smtp.gmail.com',
  },
  smtp_port: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 587,
  },
  smtp_user: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Alamat email pengirim',
  },
  smtp_pass: {
    type: DataTypes.STRING(512),
    allowNull: false,
    comment: 'Password / App Password (disimpan terenkripsi)',
  },
  smtp_from: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Alamat From (default = smtp_user)',
  },
  smtp_secure: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'true = SSL (port 465), false = STARTTLS (port 587)',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  urutan: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Urutan failover. 0 = paling utama',
  },
}, {
  tableName: 'email_servers',
  timestamps: true,
  paranoid: false,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  indexes: [
    { fields: ['tipe', 'urutan'] },
    { fields: ['is_active'] },
  ],
});

module.exports = EmailServer;
