/** codes 정규화 — by-country API·클라이언트 prefetch 캐시 키 SSOT */
export function normalizeProductsByCountryKey(codes: string[]): string {
  return [...codes]
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
}
