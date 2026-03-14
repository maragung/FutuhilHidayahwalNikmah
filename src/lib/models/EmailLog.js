const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EmailLog = sequelize.define('EmailLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email_server_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'email_servers', key: 'id' },
    comment: 'Server yang digunakan untuk mengirim',
  },
  server_nama: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nama server saat pengiriman (snapshot)',
  },
  dari: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  kepada: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  subjek: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('success', 'failed'),
    allowNull: false,
    defaultValue: 'failed',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  response: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'messageId atau response dari SMTP',
  },
  konteks: {
    type: DataTypes.STRING(120),
    allowNull: true,
    defaultValue: 'SYSTEM',
    comment: 'Konteks pengiriman: CRUD, SARAN, TEST, dsb',
  },
}, {
  tableName: 'email_logs',
  timestamps: true,
  paranoid: false,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['created_at'] },
    { fields: ['konteks'] },
  ],
});

module.exports = EmailLog;
