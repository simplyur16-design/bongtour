import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

// REGRESSION-FREEZE[bongsim-default-trip-days-ssot]: 국가·권역 기본 이용일수 — manifest
export const REGION_PACK_DEFAULT_TRIP_DAYS: Record<string, number> = {
  "rg-eu-42": 10,
  "rg-eu-36": 10,
  "rg-eu-33": 10,
  "rg-eu-27": 10,
  "rg-es-pt": 8,
  "rg-us-ca": 10,
  "rg-na-3": 10,
  "rg-sea-3": 5,
  "rg-sea-8": 5,
  "rg-cn-hk-mo": 4,
  "rg-hk-mo": 3,
  "rg-gu-mp": 5,
  "rg-au-nz": 7,
  "rg-as-13": 5,
  "rg-nafr-4": 8,
  "rg-sa-11": 12,
  "rg-global-151": 10,
  "rg-benelux-3": 7,
  "rg-nordic-5": 8,
  "rg-me-6": 7,
  "rg-ca-5": 8,
  "rg-kr-jp": 5,
  "rg-kr-cn-jp": 6,
  "rg-fr-ch-it": 8,
};

/** simplyur(한국 inbound) — 외국인 평균 체류 4~7일, 기본 5일 */
export const SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS = 5;

const TIER_3 = new Set(["jp"]);
const TIER_4 = new Set(["cn", "hk", "mo"]);
const TIER_5 = new Set([
  "th",
  "vn",
  "ph",
  "kh",
  "la",
  "mm",
  "id",
  "my",
  "sg",
  "bn",
  "tw",
  "gu",
  "mp",
]);
const TIER_6 = new Set(["lk", "np", "pk", "bd", "bt", "fj", "pf", "nc", "ws", "pr"]);
const TIER_7 = new Set(["au", "nz", "mu", "sc", "mv", "mn", "kz", "uz", "ge", "az", "kr"]);
const TIER_8 = new Set([
  "in",
  "tr",
  "eg",
  "ma",
  "il",
  "jo",
  "ae",
  "sa",
  "qa",
  "kw",
  "om",
  "bh",
  "tz",
  "ke",
  "na",
  "gh",
  "ng",
  "et",
  "tn",
  "dz",
  "iq",
  "lb",
  "sn",
  "is",
  "cy",
  "ie",
  "hr",
  "me",
  "mk",
  "ba",
  "xk",
  "by",
  "fo",
  "li",
  "va",
]);
const TIER_10 = new Set([
  "us",
  "ca",
  "mx",
  "ru",
  "ua",
  "za",
  "at",
  "be",
  "bg",
  "cz",
  "dk",
  "ee",
  "fi",
  "fr",
  "de",
  "gr",
  "hu",
  "it",
  "lv",
  "lt",
  "lu",
  "mt",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "sk",
  "si",
  "es",
  "se",
  "ch",
  "gb",
  "rs",
  "al",
  "md",
]);
const TIER_12 = new Set([
  "ar",
  "br",
  "cl",
  "co",
  "pe",
  "uy",
  "ec",
  "bo",
  "py",
  "ve",
  "cr",
  "pa",
  "do",
  "gt",
  "hn",
  "ni",
  "sv",
  "jm",
  "cu",
]);

const FALLBACK_DEFAULT_DAYS = 7;

/**
 * 목적지 코드 → 권장 기본 이용 일수 (카탈로그 스냅 전 선호값).
 * 사용자 지정: 일본 3·동남아 5·유럽 10·중국 4·미국 10
 */
export function resolveDefaultTripDays(destinationCode: string): number {
  const code = destinationCode.trim().toLowerCase();
  if (!code) return FALLBACK_DEFAULT_DAYS;

  if (isRegionPackCode(code)) {
    return REGION_PACK_DEFAULT_TRIP_DAYS[code] ?? 10;
  }

  if (TIER_3.has(code)) return 3;
  if (TIER_4.has(code)) return 4;
  if (TIER_5.has(code)) return 5;
  if (TIER_6.has(code)) return 6;
  if (TIER_7.has(code)) return 7;
  if (TIER_8.has(code)) return 8;
  if (TIER_10.has(code)) return 10;
  if (TIER_12.has(code)) return 12;

  return FALLBACK_DEFAULT_DAYS;
}

/** 카탈로그에 있는 일수 중 preferred에 가장 가까운 값 */
export function snapTripDaysToAvailable(preferred: number, available: number[]): number | null {
  if (!available.length) return null;
  const pref = Math.max(1, Math.floor(preferred));
  if (available.includes(pref)) return pref;
  return available.reduce((best, d) =>
    Math.abs(d - pref) < Math.abs(best - pref) ? d : best,
  );
}

export function pickDefaultTripDaysForDestination(
  destinationCode: string,
  availableDays: number[],
): number | null {
  const preferred = resolveDefaultTripDays(destinationCode);
  return snapTripDaysToAvailable(preferred, availableDays);
}
