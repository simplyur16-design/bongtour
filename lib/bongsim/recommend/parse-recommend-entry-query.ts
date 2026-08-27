/**
 * 홈 국기 타일 → `/recommend?country=` 진입 파싱 (ISR 페이지는 서버 searchParams 금지).
 * REGRESSION-FREEZE[bongsim-recommend-country-unlimited-first]: 국가 쿼리 스킵 피커 — manifest
 */

const ISO2 = /^[a-z]{2}$/;
const REGION_PACK = /^rg-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseRecommendCountryQuery(search: string): string | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  let raw: string | null;
  try {
    raw = new URLSearchParams(q).get("country");
  } catch {
    return null;
  }
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  if (code.length === 0 || code.length > 40) return null;
  if (ISO2.test(code)) return code;
  if (REGION_PACK.test(code)) return code;
  return null;
}
