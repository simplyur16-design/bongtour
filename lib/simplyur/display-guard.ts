/** simplyur UI must not show Korean catalog/order copy (bongsim DB is Korean-first). */
export function containsHangul(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

export function withoutHangul(text: string, fallback: string): string {
  const t = text.trim();
  if (!t || containsHangul(t)) return fallback;
  return t;
}
