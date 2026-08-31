/**
 * 발송·풀 고친 뒤 목록/상세가 다시 갈라지면 prebuild 실패.
 * 라이브 HTTP 없음 — 분류·예산·라우트 바늘만.
 * REGRESSION-FREEZE[esim-fulfill-keep-catalog-pipe]: list-detail pipe verify — manifest
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyBongsimPgError,
  resolveBongsimCatalogPoolMax,
  resolveBongsimOutboxPoolMaxClamped,
  resolveBongsimPoolMax,
} from "@/lib/bongsim/db/pool";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function fail(msg: string): never {
  console.error(`[verify:esim-list-detail-pipe] ${msg}`);
  process.exit(1);
}

if (
  classifyBongsimPgError(new Error("(EMAXCONN) max client connections reached, limit: 200")) !==
  "connection_timeout"
) {
  fail("live EMAXCONN text must classify as connection_timeout, not db_error");
}

const prevTotal = process.env.BONGSIM_PG_POOL_MAX;
const prevOut = process.env.BONGSIM_OUTBOX_POOL_MAX;
try {
  process.env.BONGSIM_PG_POOL_MAX = "10";
  delete process.env.BONGSIM_OUTBOX_POOL_MAX;
  if (resolveBongsimCatalogPoolMax() + resolveBongsimOutboxPoolMaxClamped() !== resolveBongsimPoolMax()) {
    fail("catalog + outbox must stay inside BONGSIM_PG_POOL_MAX");
  }
} finally {
  if (prevTotal === undefined) delete process.env.BONGSIM_PG_POOL_MAX;
  else process.env.BONGSIM_PG_POOL_MAX = prevTotal;
  if (prevOut === undefined) delete process.env.BONGSIM_OUTBOX_POOL_MAX;
  else process.env.BONGSIM_OUTBOX_POOL_MAX = prevOut;
}

const detailRoute = read("app/api/simplyur/products/[optionApiId]/route.ts");
if (!detailRoute.includes("loadSimplyurKoreaProductByOptionIdCached")) {
  fail("product detail API must use the same Korea cache as the list");
}

const checkout = read("app/simplyur/[locale]/checkout/page.tsx");
if (!checkout.includes("loadSimplyurKoreaProductByOptionIdCached")) {
  fail("checkout must use the same Korea cache as the list");
}

const mobileProduct = read("apps/simplyur-mobile/app/(tabs)/product/[optionApiId].tsx");
if (!mobileProduct.includes("unavailable") || !/API \(5\\d\\d/.test(mobileProduct)) {
  fail("mobile product must not map 5xx to Plan not found");
}

console.log("verify-esim-list-detail-pipe: ok");
