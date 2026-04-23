const COUNTRIES_KEY = "bongsim:recentCountries:v1";
const SEARCHES_KEY = "bongsim:recentSearches:v1";

function readCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COUNTRIES_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function readSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCHES_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentCountry(code: string): void {
  if (typeof window === "undefined" || code === "kr") return;
  const cur = readCodes().filter((c) => c !== "kr");
  const next = [code, ...cur.filter((c) => c !== code)].slice(0, 12);
  window.localStorage.setItem(COUNTRIES_KEY, JSON.stringify(next));
}

export function pushRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  const t = query.trim();
  if (t.length < 2) return;
  const cur = readSearches();
  const next = [t, ...cur.filter((s) => s !== t)].slice(0, 8);
  window.localStorage.setItem(SEARCHES_KEY, JSON.stringify(next));
}

/** 최근 선택·조회 기준 상위 코드 (대한민국 제외, 최대 5). */
export function getRecentCountryCodes(max = 5): string[] {
  return readCodes().filter((c) => c !== "kr").slice(0, max);
}
