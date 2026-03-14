const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const IdempotencyKey = sequelize.define('IdempotencyKey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  idempotency_key: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  route: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  actor_scope: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'public',
  },
  actor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  request_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PROCESSING', 'COMPLETED'),
    allowNull: false,
    defaultValue: 'PROCESSING',
  },
  response_status: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  response_body: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'idempotency_keys',
  timestamps: true,
  paranoid: false,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  indexes: [
    {
      name: 'idx_idempotency_route_scope',
      fields: ['route', 'actor_scope', 'actor_id'],
    },
    {
      name: 'idx_idempotency_expires_at',
      fields: ['expires_at'],
    },
  ],
});

module.exports = IdempotencyKey;