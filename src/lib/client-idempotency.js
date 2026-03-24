export function createIdempotencyKey(prefix = 'req') {
  const randomPart = typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;

  return `${prefix}-${randomPart}`;
}