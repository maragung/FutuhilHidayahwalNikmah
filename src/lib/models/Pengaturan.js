const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Pengaturan = sequelize.define('Pengaturan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  kunci: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  nilai: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  keterangan: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'pengaturan',
});

// Helper statis untuk mendapatkan nilai pengaturan
Pengaturan.getNilai = async function(kunci, defaultValue = null) {
  const row = await this.findOne({ where: { kunci } });
  return row ? row.nilai : defaultValue;
};

Pengaturan.setNilai = async function(kunci, nilai, keterangan = null) {
  const [row, created] = await this.findOrCreate({
    where: { kunci },
    defaults: { nilai, keterangan },
  });
  if (!created) {
    row.nilai = nilai;
    if (keterangan) row.keterangan = keterangan;
    await row.save();
  }
  return row;
};

module.exports = Pengaturan;
