const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const bcrypt = require('bcryptjs');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nama_lengkap: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  jabatan: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Pengajar',
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id',
    },
    comment: '1=Pimpinan TPQ, 2=Sekretaris, 3=Bendahara, 4=Pengajar, 5=Lainnya',
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    validate: {
      is: /^[a-zA-Z0-9._-]+$/,
      len: [3, 50],
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  pin: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  akses: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
      const raw = this.getDataValue('akses');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    set(val) {
      this.setDataValue('akses', val ? JSON.stringify(val) : null);
    },
  },
  terima_email_perubahan: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'admins',
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        admin.password = await bcrypt.hash(admin.password, 10);
      }
      if (admin.pin) {
        admin.pin = await bcrypt.hash(admin.pin, 10);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        admin.password = await bcrypt.hash(admin.password, 10);
      }
      if (admin.changed('pin')) {
        admin.pin = await bcrypt.hash(admin.pin, 10);
      }
    },
  },
});

Admin.prototype.validPassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

Admin.prototype.validPin = async function(pin) {
  if (!this.pin) return false;
  return bcrypt.compare(pin, this.pin);
};

module.exports = Admin;
