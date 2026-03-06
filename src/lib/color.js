export function safeHexColor(value, fallback = '#111827') {
  const color = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toUpperCase();
  }
  return fallback;
}
