/**
 * One-time QR nonce store.
 *
 * Each nonce is valid for 2 minutes and can be used exactly once.
 * The QR code encodes the nonce (not the JWT token), so a screenshot of the QR
 * can only be used within that 2-minute window or until the first successful scan.
 *
 * For multi-instance / serverless deployments replace the Map with Redis:
 *   await redis.set(`qrnonce:${nonce}`, JSON.stringify(payload), { ex: 120, nx: true })
 */

import crypto from 'crypto';

const NONCE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * @typedef {{ adminId: number, serverUrl: string, expiresAt: number, used: boolean }} NonceEntry
 * @type {Map<string, NonceEntry>}
 */
const store = new Map();

/** Remove expired entries to prevent unbounded memory growth. */
function cleanup() {
  const now = Date.now();
  for (const [nonce, entry] of store) {
    if (entry.expiresAt < now) store.delete(nonce);
  }
}

/**
 * Create a new one-time nonce tied to a specific admin + serverUrl.
 * @param {number} adminId
 * @param {string} serverUrl
 * @returns {string} 64-character hex nonce
 */
export function createNonce(adminId, serverUrl) {
  cleanup();
  const nonce = crypto.randomBytes(32).toString('hex');
  store.set(nonce, {
    adminId,
    serverUrl,
    expiresAt: Date.now() + NONCE_TTL_MS,
    used: false,
  });
  return nonce;
}

/**
 * Validate and consume a nonce.
 * A nonce can only be consumed once; subsequent calls return `valid: false`.
 *
 * @param {string} nonce
 * @returns {{ valid: true, adminId: number, serverUrl: string }
 *           | { valid: false, reason: string }}
 */
export function consumeNonce(nonce) {
  cleanup();

  if (!nonce || typeof nonce !== 'string' || !/^[0-9a-f]{64}$/.test(nonce)) {
    return { valid: false, reason: 'Format nonce tidak valid.' };
  }

  const entry = store.get(nonce);

  if (!entry) {
    return { valid: false, reason: 'QR code tidak dikenal atau sudah kadaluarsa.' };
  }

  if (entry.used) {
    return { valid: false, reason: 'QR code sudah pernah digunakan.' };
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(nonce);
    return { valid: false, reason: 'QR code kadaluarsa (berlaku 2 menit). Hasilkan QR code baru.' };
  }

  // Mark as used — subsequent calls with the same nonce will be rejected
  entry.used = true;

  return { valid: true, adminId: entry.adminId, serverUrl: entry.serverUrl };
}
