const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nama_role: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  deskripsi: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // JSON array of akses keys that this role has by default
  akses_default: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
      const raw = this.getDataValue('akses_default');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    set(val) {
      this.setDataValue('akses_default', val ? JSON.stringify(val) : null);
    },
  },
  // is_system: true = built-in role (cannot be deleted), false = custom role
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 99,
    comment: '1=Pimpinan TPQ, 2=Sekretaris, 3=Bendahara, 4=Pengajar, 5=Lainnya, >5=custom',
  },
}, {
  tableName: 'roles',
});

module.exports = Role;
