const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Backup = sequelize.define('Backup', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tgl_backup: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  aksi: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  tabel: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  data_sebelum: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  data_sesudah: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
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
  tableName: 'backup_log',
});

module.exports = Backup;
