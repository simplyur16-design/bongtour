import type { CountryOption, RegionOption } from "./types";

/** 비즈니스 노출 우선순위 (가나다순 아님). 필수 4종을 앞에 둠. */
export const REGION_CATALOG: RegionOption[] = [
  { code: "rg-eu-42", title: "유럽", subtitle: "42개국", icon: "🇪🇺", isUnlimited: true, searchTerms: ["europe", "유럽"] },
  { code: "rg-us-ca", title: "미국", subtitle: "캐나다", icon: "🇺🇸", isUnlimited: true, searchTerms: ["usa", "canada"] },
  { code: "rg-sea-3", title: "동남아", subtitle: "3개국", icon: "🇧🇳", isUnlimited: true, searchTerms: ["asean", "southeast asia"] },
  { code: "rg-global-151", title: "글로벌", subtitle: "151개국", icon: "🌐", searchTerms: ["global", "world"] },
  { code: "rg-eu-36", title: "유럽", subtitle: "36개국", icon: "🇪🇺", isUnlimited: true, searchTerms: ["europe"] },
  { code: "rg-eu-33", title: "유럽", subtitle: "33개국", icon: "🇪🇺", isUnlimited: true, searchTerms: ["europe"] },
  { code: "rg-eu-27", title: "유럽", subtitle: "27개국", icon: "🇪🇺", isUnlimited: true, searchTerms: ["europe"] },
  { code: "rg-es-pt", title: "스페인", subtitle: "포르투갈", icon: "🇪🇸", isUnlimited: true, searchTerms: ["spain", "portugal"] },
  { code: "rg-au-nz", title: "호주", subtitle: "뉴질랜드", icon: "🇦🇺", isUnlimited: true, searchTerms: ["australia", "new zealand"] },
  { code: "rg-na-3", title: "북중미", subtitle: "3개국", icon: "🇺🇸", isUnlimited: true, searchTerms: ["north america"] },
  { code: "rg-cn-hk-mo", title: "중국", subtitle: "홍콩·마카오", icon: "🇨🇳", isUnlimited: true, searchTerms: ["china", "hong kong", "macau"] },
  { code: "rg-hk-mo", title: "홍콩", subtitle: "마카오", icon: "🇭🇰", isUnlimited: true, searchTerms: ["hong kong", "macau"] },
  { code: "rg-gu-mp", title: "괌", subtitle: "사이판", icon: "🇬🇺", searchTerms: ["guam", "saipan"] },
  { code: "rg-sea-8", title: "동남아", subtitle: "8개국", icon: "🇧🇳", isUnlimited: true, searchTerms: ["asean"] },
  { code: "rg-as-13", title: "아시아", subtitle: "13개국", icon: "🌏", isUnlimited: true, searchTerms: ["asia"] },
  { code: "rg-nafr-4", title: "북아프리카", subtitle: "4개국(경유)", icon: "🇪🇬", isUnlimited: true, searchTerms: ["africa"] },
  { code: "rg-sa-11", title: "남미", subtitle: "11개국", icon: "🇧🇷", searchTerms: ["south america", "brazil"] },
];

function mapRegion(r: RegionOption): CountryOption {
  return {
    code: r.code,
    nameKr: r.title,
    subtitleKr: r.subtitle,
    flag: r.icon,
    isUnlimited: r.isUnlimited,
    isRegion: true,
    searchTerms: r.searchTerms,
  };
}

export const REGION_PACK_OPTIONS: CountryOption[] = REGION_CATALOG.map(mapRegion);

/** STEP 1 다국가 탭 전용(4종, 비즈니스 노출 순서). */
const RECOMMEND_MULTI_REGION: RegionOption[] = [
  {
    code: "rg-eu-42",
    title: "유럽 42개국",
    subtitle: "유럽 주요국·경유지 데이터",
    icon: "🇪🇺",
    isUnlimited: true,
    searchTerms: ["europe", "유럽", "42"],
  },
  {
    code: "rg-us-ca",
    title: "미국/캐나다",
    subtitle: "북미 동시 커버",
    icon: "🇺🇸",
    isUnlimited: true,
    searchTerms: ["usa", "canada", "미국", "캐나다"],
  },
  {
    code: "rg-sea-3",
    title: "동남아 3개국",
    subtitle: "태국·베트남·싱가포르 등",
    icon: "🌏",
    isUnlimited: true,
    searchTerms: ["동남아", "asean", "southeast"],
  },
  {
    code: "rg-global-151",
    title: "글로벌 151개국",
    subtitle: "광역 데이터 패스",
    icon: "🌐",
    isUnlimited: true,
    searchTerms: ["global", "글로벌", "151"],
  },
];

export const RECOMMEND_MULTI_PACK_OPTIONS: CountryOption[] = RECOMMEND_MULTI_REGION.map(mapRegion);

export function filterRegionPacks(query: string): CountryOption[] {
  const t = query.trim().toLowerCase();
  if (!t) return REGION_PACK_OPTIONS;
  return REGION_PACK_OPTIONS.filter((c) => {
    if (c.nameKr.toLowerCase().includes(t)) return true;
    if (c.subtitleKr?.toLowerCase().includes(t)) return true;
    if (c.code.toLowerCase().includes(t)) return true;
    return c.searchTerms?.some((s) => s.toLowerCase().includes(t)) ?? false;
  });
}
