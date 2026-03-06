const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Log = sequelize.define('Log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  level: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'INFO',
  },
  context: {
    type: DataTypes.STRING(120),
    allowNull: false,
    defaultValue: 'SYSTEM',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'logs',
});

module.exports = Log;
