/** @type {import('next').NextConfig} */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['sequelize', 'mysql2', 'pg-hstore'],
  async headers() {
    // Jika ALLOWED_ORIGINS di-set, gunakan origin pertama; jika tidak, izinkan sama-origin saja
    const origin = allowedOrigins[0] || '';
    return [
      {
        source: '/api/:path*',
        headers: [
          ...(origin ? [{ key: 'Access-Control-Allow-Origin', value: origin }] : []),
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
