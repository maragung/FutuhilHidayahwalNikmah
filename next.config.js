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
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
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
