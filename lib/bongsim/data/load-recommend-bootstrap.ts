import { prisma } from "@/lib/prisma";
import { listCountryCatalogMetaByCode } from "@/lib/bongsim/data/list-country-catalog-meta";
import { listBongsimStandaloneCountries } from "@/lib/bongsim/data/list-standalone-countries";
import { getPgPool } from "@/lib/bongsim/db/pool";
import type { CountryCatalogMeta } from "@/lib/bongsim/data/list-country-catalog-meta";
import { RECOMMEND_CATALOG_META_REGION_CODES } from "@/lib/bongsim/recommend/recommend-destination-sections";
import { RECOMMEND_POPULAR_CODES } from "@/lib/bongsim/home-data";

const ENTITY_TYPE = "bongsim_esim_country";
const IMAGE_ROLE = "recommend_hero";

export type BongsimCountryListItem = {
  code: string;
  nameKr: string;
  isUnlimited?: boolean;
  travelerVerification?: "none" | "mixed" | "required";
};

export type BongsimRecommendBootstrap = {
  countries: BongsimCountryListItem[];
  catalogMeta: Record<string, CountryCatalogMeta>;
  heroMap: Record<string, string>;
};

export type BongsimRecommendBootstrapResult =
  | { ok: true; data: BongsimRecommendBootstrap }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

// REGRESSION-FREEZE[bongsim-recommend-server-bootstrap-p3]: recommend 서버 프리로드 — manifest

export async function loadBongsimCountryHeroMap(): Promise<Record<string, string>> {
  const rows = await prisma.imageAsset.findMany({
    where: {
      entityType: ENTITY_TYPE,
      imageRole: IMAGE_ROLE,
      isPrimary: true,
    },
    select: {
      entityId: true,
      publicUrl: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const heroes: Record<string, string> = {};
  for (const r of rows) {
    const code = r.entityId.trim().toLowerCase();
    const url = r.publicUrl.trim();
    if (!code || !url) continue;
    if (heroes[code] !== undefined) continue;
    heroes[code] = url;
  }
  return heroes;
}

export async function loadBongsimCountriesPayload(): Promise<
  | { ok: true; countries: BongsimCountryListItem[]; catalogMeta: Record<string, CountryCatalogMeta> }
  | { ok: false; reason: "db_unconfigured" | "db_error" }
> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  try {
    const countries = await listBongsimStandaloneCountries(pool);
    const metaCodes = [
      ...countries.map((c) => c.code),
      ...RECOMMEND_POPULAR_CODES,
      ...RECOMMEND_CATALOG_META_REGION_CODES,
    ];
    const metaByCode = await listCountryCatalogMetaByCode(pool, metaCodes);

    const enriched: BongsimCountryListItem[] = countries.map((c) => {
      const meta = metaByCode[c.code.toLowerCase()];
      return {
        code: c.code,
        nameKr: c.nameKr,
        ...(meta?.isUnlimited ? { isUnlimited: true } : {}),
        ...(meta?.travelerVerification && meta.travelerVerification !== "none"
          ? { travelerVerification: meta.travelerVerification }
          : {}),
      };
    });

    return { ok: true, countries: enriched, catalogMeta: metaByCode };
  } catch (e) {
    console.error("[loadBongsimCountriesPayload]", e);
    return { ok: false, reason: "db_error" };
  }
}

export async function loadBongsimRecommendBootstrap(): Promise<BongsimRecommendBootstrapResult> {
  const countriesRes = await loadBongsimCountriesPayload();
  if (!countriesRes.ok) return countriesRes;

  try {
    const heroMap = await loadBongsimCountryHeroMap();
    return {
      ok: true,
      data: {
        countries: countriesRes.countries,
        catalogMeta: countriesRes.catalogMeta,
        heroMap,
      },
    };
  } catch (e) {
    console.error("[loadBongsimRecommendBootstrap]", e);
    return { ok: false, reason: "db_error" };
  }
}
