import jwt from 'jsonwebtoken';

const DEV_FALLBACK_JWT_SECRET = 'dev-only-jwt-secret-tpq-futuhil-hidayah';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET harus diatur pada environment production');
  }

  return DEV_FALLBACK_JWT_SECRET;
}

export function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, resolveJwtSecret(), { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, resolveJwtSecret());
  } catch (error) {
    return null;
  }
}

export function getTokenFromRequest(request) {
  // Cek dari header Authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Cek dari cookies (NextRequest)
  if (request.cookies?.get) {
    return request.cookies.get('auth_token')?.value || null;
  }

  // Fallback parser cookie mentah
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const tokenPair = cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('auth_token='));

    if (tokenPair) {
      return decodeURIComponent(tokenPair.substring('auth_token='.length));
    }
  }

  return null;
}

export async function verifyAuth(request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return { success: false, error: 'Token tidak ditemukan' };
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return { success: false, error: 'Token tidak valid atau kadaluarsa' };
  }
  
  return { success: true, user: decoded };
}

export function createAuthResponse(user, tokenExpiresIn = JWT_EXPIRES_IN) {
  const token = generateToken({
    id: user.id,
    username: user.username,
    email: user.email,
    nama_lengkap: user.nama_lengkap,
    jabatan: user.jabatan,
  }, tokenExpiresIn);
  
  return { token, user: {
    id: user.id,
    username: user.username,
    email: user.email,
    nama_lengkap: user.nama_lengkap,
    jabatan: user.jabatan,
  }};
}
