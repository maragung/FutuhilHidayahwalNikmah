export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function toStringValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function readRequiredText(value, label, { min = 1, max = 255 } = {}) {
  const normalized = toStringValue(value).trim();

  if (!normalized) {
    throw new ValidationError(`${label} wajib diisi`);
  }

  if (normalized.length < min) {
    throw new ValidationError(`${label} minimal ${min} karakter`);
  }

  if (normalized.length > max) {
    throw new ValidationError(`${label} maksimal ${max} karakter`);
  }

  return normalized;
}

export function readOptionalText(value, { max = 1000 } = {}) {
  const normalized = toStringValue(value).trim();

  if (!normalized) return null;
  if (normalized.length > max) {
    throw new ValidationError(`Input maksimal ${max} karakter`);
  }

  return normalized;
}

export function readPositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${label} tidak valid`);
  }
  return parsed;
}

export function readPositiveAmount(value, label) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`${label} tidak boleh negatif`);
  }
  return parsed;
}

export function readEnumValue(value, label, allowed, fallback = null) {
  const normalized = toStringValue(value).trim();
  const finalValue = normalized || fallback;

  if (!finalValue || !allowed.includes(finalValue)) {
    throw new ValidationError(`${label} tidak valid`);
  }

  return finalValue;
}

export function readDateValue(value, label, fallback = null) {
  if (!value && fallback) {
    return new Date(fallback);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${label} tidak valid`);
  }

  return parsed;
}

export function ensureArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${label} wajib diisi`);
  }
  return value;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toStringValue(value).trim());
}

export function isValidPhone(value) {
  return /^\+?[0-9\s-]{8,20}$/.test(toStringValue(value).trim());
}