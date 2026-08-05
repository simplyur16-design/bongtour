/**
 * 실검증: 어드민 플랜 카탈로그에 supply_krw가 포함되는지 (DB).
 *   npx dotenv -e .env.local -- npx tsx scripts/verify-admin-plan-catalog-supply.ts
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

import {
  BONGSIM_CATALOG_ACTIVE_WHERE,
  BONGSIM_CATALOG_OFFLINE_USIM_WHERE,
} from "@/lib/bongsim/catalog/active-product-sql";
import { afterSupplyCostKrw } from "@/lib/bongsim/data/pricing-after-recommended-krw";
import { getPgPool, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";
import { queryPlanCatalog } from "@/lib/bongsim/recommend/query-plan-catalog";

function fail(msg: string): never {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`[ok] ${msg}`);
}

async function assertAdminCatalog(label: string, where: string, country: string, days: number) {
  const pool = getPgPool();
  if (!pool) fail("no pool");

  const without = await queryPlanCatalog({
    pool,
    country,
    days,
    allSelected: [country],
    catalogWhere: where,
    includeSupplyKrw: false,
  });
  const withSupply = await queryPlanCatalog({
    pool,
    country,
    days,
    allSelected: [country],
    catalogWhere: where,
    includeSupplyKrw: true,
  });

  const allWith = [
    ...withSupply.groups.unlimited,
    ...withSupply.groups.daily,
    ...withSupply.groups.fixed,
  ];
  if (allWith.length === 0) fail(`${label} ${country}/${days}: empty groups`);

  const supplyHits = allWith.filter((p) => afterSupplyCostKrw(p.price_block) != null).length;
  const withoutHits = [
    ...without.groups.unlimited,
    ...without.groups.daily,
    ...without.groups.fixed,
  ].filter((p) => afterSupplyCostKrw(p.price_block) != null).length;

  if (withoutHits > 0) {
    fail(`${label} public slim should not expose supply_krw (got ${withoutHits})`);
  }
  if (supplyHits === 0) {
    fail(`${label} admin includeSupplyKrw=true but no supply_krw on any plan`);
  }

  ok(
    `${label} ${country}/${days}: groups=${allWith.length} supply=${supplyHits} matched=${withSupply.matched_days}`,
  );
}

async function main() {
  await probePgPoolTlsOrFallback();
  if (!getPgPool()) fail("NO_POOL");

  await assertAdminCatalog("complimentary", BONGSIM_CATALOG_ACTIVE_WHERE, "jp", 7);
  await assertAdminCatalog("offline_usim", BONGSIM_CATALOG_OFFLINE_USIM_WHERE, "jp", 7);
  await assertAdminCatalog("complimentary", BONGSIM_CATALOG_ACTIVE_WHERE, "vn", 5);

  // public prod sanity
  const res = await fetch("https://bongtour.com/api/bongsim/products/plans?country=jp&days=7", {
    cache: "no-store",
  });
  if (!res.ok) fail(`prod plans HTTP ${res.status}`);
  const j = (await res.json()) as {
    groups?: { unlimited?: unknown[]; daily?: unknown[]; fixed?: unknown[] };
  };
  const n =
    (j.groups?.unlimited?.length ?? 0) +
    (j.groups?.daily?.length ?? 0) +
    (j.groups?.fixed?.length ?? 0);
  if (n < 1) fail("prod plans empty groups");
  ok(`prod public plans jp/7 groups=${n}`);

  console.log("VERIFY_OK");
  await getPgPool()!.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
