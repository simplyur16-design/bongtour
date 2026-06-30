import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import type { CountryOption } from "@/lib/bongsim/types";

export type OfflineUsimDestinationKind = "country" | "pack";

export type OfflineUsimDestinationOption = CountryOption & {
  kind: OfflineUsimDestinationKind;
};

/** 매장 피커 — 인기 단일 국가 (비즈니스 우선) */
export const OFFLINE_USIM_POPULAR_COUNTRY_CODES = [
  "jp",
  "th",
  "vn",
  "cn",
  "us",
  "sg",
  "tw",
  "gu",
] as const;

/** 매장 피커 — 인기 다국가 패키지 */
export const OFFLINE_USIM_POPULAR_PACK_CODES = [
  "rg-eu-42",
  "rg-us-ca",
  "rg-sea-3",
  "rg-global-151",
] as const;

const ALL_COUNTRY_DESTINATIONS: OfflineUsimDestinationOption[] = COUNTRY_OPTIONS.map((c) => ({
  ...c,
  kind: "country" as const,
}));

const ALL_PACK_DESTINATIONS: OfflineUsimDestinationOption[] = REGION_PACK_OPTIONS.map((c) => ({
  ...c,
  kind: "pack" as const,
}));

export const OFFLINE_USIM_ALL_DESTINATIONS: OfflineUsimDestinationOption[] = [
  ...ALL_COUNTRY_DESTINATIONS,
  ...ALL_PACK_DESTINATIONS,
];

export function offlineUsimDestinationByCode(code: string): OfflineUsimDestinationOption | null {
  const lc = code.trim().toLowerCase();
  return OFFLINE_USIM_ALL_DESTINATIONS.find((d) => d.code === lc) ?? null;
}

export function offlineUsimDestinationLabel(code: string): string {
  const d = offlineUsimDestinationByCode(code);
  if (!d) return code.toUpperCase();
  if (d.subtitleKr) return `${d.nameKr} (${d.subtitleKr})`;
  return d.nameKr;
}

export function offlineUsimSelectedSummary(codes: string[]): string {
  if (codes.length === 0) return "";
  if (codes.length === 1) return offlineUsimDestinationLabel(codes[0]!);
  return codes.map((c) => offlineUsimDestinationByCode(c)?.nameKr ?? c.toUpperCase()).join(" · ");
}

export function filterOfflineUsimDestinations(
  query: string,
  opts?: { kinds?: OfflineUsimDestinationKind[] },
): OfflineUsimDestinationOption[] {
  const kinds = opts?.kinds ?? ["country", "pack"];
  const t = query.trim().toLowerCase();
  const pool = OFFLINE_USIM_ALL_DESTINATIONS.filter((d) => kinds.includes(d.kind));
  if (!t) return pool;
  return pool.filter((d) => {
    if (d.nameKr.toLowerCase().includes(t)) return true;
    if (d.subtitleKr?.toLowerCase().includes(t)) return true;
    if (d.code.toLowerCase().includes(t)) return true;
    return d.searchTerms?.some((s) => s.toLowerCase().includes(t)) ?? false;
  });
}

export function offlineUsimPopularDestinations(): OfflineUsimDestinationOption[] {
  const countries = OFFLINE_USIM_POPULAR_COUNTRY_CODES.map((code) =>
    ALL_COUNTRY_DESTINATIONS.find((c) => c.code === code),
  ).filter(Boolean) as OfflineUsimDestinationOption[];
  const packs = OFFLINE_USIM_POPULAR_PACK_CODES.map((code) =>
    ALL_PACK_DESTINATIONS.find((c) => c.code === code),
  ).filter(Boolean) as OfflineUsimDestinationOption[];
  return [...countries, ...packs];
}

/** 국가 토글 / 패키지 단일 선택 — 고객 추천 퍼널과 동일 규칙 */
export function toggleOfflineUsimDestinationSelection(
  prev: string[],
  code: string,
): string[] {
  const lc = code.trim().toLowerCase();
  if (isRegionPackCode(lc)) {
    return prev.length === 1 && prev[0] === lc ? [] : [lc];
  }
  const withoutPacks = prev.filter((c) => !isRegionPackCode(c));
  if (withoutPacks.includes(lc)) {
    return withoutPacks.filter((c) => c !== lc);
  }
  return [...withoutPacks, lc];
}

export function isOfflineUsimDestinationSelected(codes: string[], code: string): boolean {
  return codes.includes(code.trim().toLowerCase());
}
