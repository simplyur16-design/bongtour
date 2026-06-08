import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import type { BongsimStandaloneCountry } from "@/lib/bongsim/data/list-standalone-countries";
import { MULTI_COUNTRY_PLAN_COVERAGE } from "@/lib/bongsim/plan-coverage-map";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import { RECOMMEND_POPULAR_EUROPE_FLAG_ISO } from "@/lib/bongsim/recommend/popular-destinations";

export type EsimCountryHeroAdminGroup = "standalone" | "europe_region" | "europe_country";

export type EsimCountryHeroAdminEntry = {
  code: string;
  nameKr: string;
  subtitleKr?: string;
  group: EsimCountryHeroAdminGroup;
};

export const ESIM_EUROPE_REGION_PACK_CODES = ["rg-eu-33", "rg-eu-36", "rg-eu-42", "rg-eu-27"] as const;

const EUROPE_COVERAGE_PLAN_NAMES = ["유럽 42개국", "유럽 36개국", "유럽 33개국"] as const;

export function buildEsimCountryHeroAdminCatalog(
  standalone: BongsimStandaloneCountry[],
): EsimCountryHeroAdminEntry[] {
  const standaloneSet = new Set(standalone.map((s) => s.code.toLowerCase()));
  const seen = new Set<string>();
  const entries: EsimCountryHeroAdminEntry[] = [];

  const push = (entry: EsimCountryHeroAdminEntry) => {
    const key = entry.code.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };

  for (const row of standalone) {
    push({ code: row.code, nameKr: row.nameKr, group: "standalone" });
  }

  const regionByCode = new Map(REGION_PACK_OPTIONS.map((r) => [r.code, r]));
  for (const code of ESIM_EUROPE_REGION_PACK_CODES) {
    const region = regionByCode.get(code);
    if (!region) continue;
    push({
      code: region.code,
      nameKr: region.nameKr,
      subtitleKr: region.subtitleKr,
      group: "europe_region",
    });
  }

  push({
    code: RECOMMEND_POPULAR_EUROPE_FLAG_ISO,
    nameKr: "유럽 (공통)",
    subtitleKr: "지역 패키지 기본 히어로",
    group: "europe_region",
  });

  const euCodes = new Set<string>();
  for (const planName of EUROPE_COVERAGE_PLAN_NAMES) {
    for (const c of MULTI_COUNTRY_PLAN_COVERAGE[planName] ?? []) {
      euCodes.add(c.toLowerCase());
    }
  }

  const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c]));
  const euCountries: EsimCountryHeroAdminEntry[] = [];
  for (const code of euCodes) {
    if (standaloneSet.has(code)) continue;
    const opt = byCode.get(code);
    if (!opt) continue;
    euCountries.push({ code: opt.code, nameKr: opt.nameKr, group: "europe_country" });
  }
  euCountries.sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));
  for (const row of euCountries) push(row);

  return entries;
}

export const ESIM_COUNTRY_HERO_ADMIN_GROUP_LABELS: Record<EsimCountryHeroAdminGroup, string> = {
  standalone: "단독 플랜 국가",
  europe_region: "유럽 패키지 · 공통",
  europe_country: "유럽 개별국 (다국가 커버)",
};
