/**
 * 다국가 eSIM 상품의 플랜명 → 커버 국가 코드 매핑.
 *
 * 엑셀 플랜명(한글) 기준. 단일 국가는 plan_name(한글 국가명)에서 코드 추출.
 */

import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";

const COVERAGE_글로벌151: string[] = [
  "gh", "gy", "gp", "gt", "gu", "gd", "gr", "za", "nl", "np", "no", "nz", "ni", "tw", "dk", "de",
  "la", "lv", "ru", "ro", "lu", "lt", "li", "ly", "mg", "mo", "my", "mx", "mc", "ma", "mu", "mr",
  "mt", "bh", "bd", "bb", "bs", "be", "ba", "bw", "bo", "bg", "br", "bn", "sa", "sm", "st", "cy",
  "sn", "rs", "sc", "se", "ch", "es", "sk", "lk", "si", "sg", "ae", "om", "hn", "au", "at", "aw",
  "az", "ie", "is", "ht", "ye", "jo", "ug", "uy", "ua", "it", "in", "id", "jp", "jm", "zm", "je",
  "gq", "cn", "cf", "dj", "gi", "zw", "td", "cz", "cl", "cm", "cv", "kz", "qa", "kh", "ca", "ke",
  "cr", "xk", "hr", "kg", "ki", "cy", "co", "cg", "cw", "kw", "cu", "th", "tz", "tr", "tt", "tn",
  "to", "pw", "py", "pa", "pg", "pk", "pe", "pt", "pl", "pr", "fr", "fj", "fi", "ph", "hk", "hu",
];

/** 엑셀/DB `plan_name`과 동일한 한글 키 (공백 차이는 resolveMultiCoverage에서 허용) */
export const MULTI_COUNTRY_PLAN_COVERAGE: Record<string, string[]> = {
  "글로벌 151개국": COVERAGE_글로벌151,
  "BIZ 글로벌 151개국": COVERAGE_글로벌151,
  "글로벌 109개국": [
    "gh", "gu", "gd", "gr", "za", "nl", "np", "no", "nz", "tw", "dk", "de", "la", "lv", "ru", "ro",
    "lu", "lt", "li", "mo", "my", "mx", "mc", "ma", "mu", "mt", "bd", "bb", "be", "ba", "br", "bn",
    "sa", "cy", "se", "ch", "es", "sk", "lk", "si", "sg", "ae", "om", "au", "at", "az", "ie", "is",
    "il", "eg", "jo", "ug", "ee", "gb", "ua", "it", "in", "id", "jp", "zm", "cn", "gi", "cz", "cl",
    "kz", "qa", "kh", "ca", "ke", "hr", "kg", "cu", "th", "tz", "tr", "tn", "pa", "pg", "pk", "pe",
    "pt", "pl", "fr", "fi", "ph", "hk", "hu",
  ],

  "유럽 42개국": [
    "gr", "nl", "no", "dk", "de", "lv", "ru", "ro", "lu", "lt", "li", "mt", "be", "ba", "bg", "se",
    "ch", "es", "sk", "si", "cy", "ie", "is", "gb", "ua", "ee", "it", "cz", "hr", "tr", "pt", "pl",
    "fr", "fi", "hu", "at", "al", "ad", "fo", "gg", "im", "me", "mk", "rs", "va", "gi",
  ],
  "유럽 33개국": [
    "gr", "nl", "no", "dk", "de", "lv", "ro", "lu", "lt", "li", "mt", "be", "bg", "se", "ch", "es",
    "sk", "si", "ie", "is", "gb", "it", "cz", "hr", "tr", "pt", "pl", "fr", "fi", "hu", "at", "cy", "ee",
  ],
  "유럽 36개국": [
    "gr", "nl", "no", "dk", "de", "lv", "ro", "lu", "lt", "li", "mt", "be", "bg", "se", "ch", "es",
    "sk", "si", "ie", "is", "gb", "it", "cz", "hr", "tr", "pt", "pl", "fr", "fi", "hu", "at", "cy",
    "ee", "al", "me", "rs",
  ],

  "아시아 13개국": ["tw", "la", "mo", "my", "vn", "sg", "id", "jp", "cn", "kh", "th", "ph", "hk"],
  "동남아 3개국": ["my", "sg", "th"],
  "동남아 8개국": ["my", "sg", "th", "mo", "vn", "id", "kh", "hk"],

  "남미10개국": ["gt", "mx", "us", "br", "ar", "ec", "uy", "cl", "co", "py", "pe"],

  "홍콩/마카오": ["hk", "mo"],
  "호주/뉴질랜드": ["au", "nz"],
  "미국/캐나다": ["us", "ca"],
  "미국/캐나다/멕시코": ["us", "ca", "mx"],
  "괌/사이판": ["gu", "mp"],
  "중국/홍콩/마카오": ["cn", "hk", "mo"],
};

const EXTRA_KO_NAME_TO_CODE: Record<string, string> = {
  대한민국: "kr",
  한국: "kr",
  "터키(튀르키예)": "tr",
  튀르키예: "tr",
  사이판: "mp",
  북마리아나제도: "mp",
};

function buildKoreanNameToCode(): Record<string, string> {
  const m: Record<string, string> = { ...EXTRA_KO_NAME_TO_CODE };
  for (const c of COUNTRY_OPTIONS) {
    const name = c.nameKr.trim();
    m[name] = c.code;
    m[name.replace(/\s+/g, "")] = c.code;
  }
  return m;
}

const KOREAN_NAME_TO_CODE = buildKoreanNameToCode();

function compact(s: string): string {
  return s.replace(/\s+/g, "");
}

function normalizeIsoCodes(codes: string[]): string[] {
  return codes.map((c) => {
    const x = c.trim().toLowerCase();
    return x === "uk" ? "gb" : x;
  });
}

/** 다국가 플랜명(엑셀/DB `plan_name`)이면 커버 국가 배열, 아니면 `undefined`. */
export function resolveMultiCoverage(planName: string): string[] | undefined {
  const t = planName.trim();
  if (MULTI_COUNTRY_PLAN_COVERAGE[t]) return MULTI_COUNTRY_PLAN_COVERAGE[t];
  const tc = compact(t);
  for (const [k, v] of Object.entries(MULTI_COUNTRY_PLAN_COVERAGE)) {
    if (compact(k) === tc) return v;
  }
  return undefined;
}

/**
 * 단일 국가 플랜명에서 국가 코드 추출 (소문자 ISO alpha-2).
 * DB `plan_name`은 한글 국가명(예: 일본, 베트남).
 */
export function extractSingleCountryCode(planName: string): string | null {
  const t = planName.trim();
  if (!t) return null;
  const noParen = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  for (const key of [t, noParen]) {
    const direct = KOREAN_NAME_TO_CODE[key] ?? KOREAN_NAME_TO_CODE[compact(key)];
    if (direct) return direct;
  }
  return null;
}

/**
 * 주어진 plan_name의 커버 국가 코드 배열 반환.
 */
export function getPlanCoveredCountries(planName: string): string[] {
  const multi = resolveMultiCoverage(planName);
  if (multi) return normalizeIsoCodes(multi);

  const code = extractSingleCountryCode(planName);
  return code ? normalizeIsoCodes([code]) : [];
}

/**
 * 사용자가 선택한 국가 코드들(selectedCodes)을 모두 커버하는 상품인지 판별.
 */
export function doesPlanCoverAllSelected(planName: string, selectedCodes: string[]): boolean {
  const covered = getPlanCoveredCountries(planName);
  if (covered.length === 0) return false;
  const norm = selectedCodes.map((c) => c.trim().toLowerCase());
  return norm.every((code) => covered.includes(code));
}
