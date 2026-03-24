// Migration script to fix referensi_kode column length in jurnal_kas table
// Run this on production database to fix the "Data too long for column" error

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if available
const envPath = path.resolve(__dirname, '../../..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  });
  console.log('Loaded environment variables from .env.local');
} else {
  console.log('.env.local not found, using environment variables');
}

// Database connection from environment variables
const database = process.env.DB_NAME || 'tpq_db';
const username = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 3306;
const sslEnabled = process.env.DB_SSL === 'true';

console.log(`Database config: ${database}@${host}:${port}, SSL: ${sslEnabled}`);

const sequelize = new Sequelize(database, username, password, {
  host,
  port,
  dialect: 'mysql',
  logging: console.log,
  dialectOptions: sslEnabled ? {
    ssl: {
      rejectUnauthorized: false,
    },
  } : {},
  pool: {
    max: 1,
    min: 0,
    acquire: 30000,
  },
});

async function migrate() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Connection established successfully.');
    
    console.log('Starting migration: Fix referensi_kode column length...');
    
    await sequelize.query(`
      ALTER TABLE jurnal_kas 
      MODIFY COLUMN referensi_kode VARCHAR(50) NOT NULL;
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('Column referensi_kode changed from VARCHAR(20) to VARCHAR(50)');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

migrate();
