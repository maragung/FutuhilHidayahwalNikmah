const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// SSL diperlukan untuk cloud database seperti Aiven, PlanetScale, dll.
// Set DB_SSL=true di .env untuk mengaktifkan SSL
// Set DB_SSL_CA=ssl/ca.pem (path relatif dari root project) untuk verifikasi CA cert
const sslEnabled = process.env.DB_SSL === 'true';

let sslCa = null;
if (sslEnabled && process.env.DB_SSL_CA) {
  const caPath = path.resolve(process.cwd(), process.env.DB_SSL_CA);
  if (fs.existsSync(caPath)) {
    sslCa = fs.readFileSync(caPath);
  }
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'tpq_futuhil_hidayah',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '+07:00',
    define: {
      timestamps: true,
      underscored: true,
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    ...(sslEnabled && {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: sslCa ? true : false, // verifikasi CA jika cert tersedia
          ...(sslCa && { ca: sslCa }),
        },
      },
    }),
  }
);

module.exports = sequelize;
