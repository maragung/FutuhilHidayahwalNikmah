import jwt from 'jsonwebtoken';

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEV_FALLBACK_JWT_SECRET = 'dev-only-jwt-secret-tpq-futuhil-hidayah';

function getCaptchaSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET harus diatur pada environment production');
  }
  return DEV_FALLBACK_JWT_SECRET;
}

export function generateCaptchaCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return code;
}

export function createCaptchaToken(code) {
  return jwt.sign(
    { type: 'captcha', code: String(code || '').toUpperCase() },
    getCaptchaSecret(),
    { expiresIn: '5m' }
  );
}

export function verifyCaptchaPayload(token, answer) {
  if (!token || !answer) {
    return { valid: false, message: 'Captcha wajib diisi' };
  }

  try {
    const decoded = jwt.verify(token, getCaptchaSecret());
    if (decoded?.type !== 'captcha') {
      return { valid: false, message: 'Captcha tidak valid' };
    }

    if (String(answer).toUpperCase() !== decoded.code) {
      return { valid: false, message: 'Captcha salah' };
    }

    return { valid: true };
  } catch {
    return { valid: false, message: 'Captcha kadaluarsa atau tidak valid' };
  }
}

export function buildCaptchaSvg(code) {
  const w = 220;
  const h = 70;
  const chars = String(code || '').split('');

  const noiseLines = Array.from({ length: 8 }).map((_, i) => {
    const x1 = (i * 31) % w;
    const y1 = (i * 17) % h;
    const x2 = (x1 + 90 + (i * 11)) % w;
    const y2 = (y1 + 30 + (i * 7)) % h;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(60,60,60,0.25)" stroke-width="1.2" />`;
  }).join('');

  const noiseDots = Array.from({ length: 30 }).map((_, i) => {
    const cx = (i * 19 + 13) % w;
    const cy = (i * 23 + 9) % h;
    return `<circle cx="${cx}" cy="${cy}" r="1.3" fill="rgba(30,30,30,0.2)" />`;
  }).join('');

  const text = chars.map((ch, i) => {
    const x = 24 + i * 31;
    const y = 46 + ((i % 2) * 4 - 2);
    const rot = (i % 2 === 0 ? -10 : 11);
    return `<text x="${x}" y="${y}" font-size="34" font-family="monospace" font-weight="700" fill="#0f172a" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
  }).join('');

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" rx="10" fill="#f8fafc"/>
    ${noiseLines}
    ${noiseDots}
    ${text}
  </svg>
  `;
}
