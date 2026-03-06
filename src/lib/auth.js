import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-tpq-futuhil-hidayah-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
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
  
  // Cek dari cookies
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    return cookies['auth_token'];
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
