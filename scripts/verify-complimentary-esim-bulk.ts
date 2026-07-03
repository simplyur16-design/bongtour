#!/usr/bin/env tsx
/**
 * 관리자 무상 eSIM 단체 일괄 발급 실검증 (HTTP + DB)
 *   npx tsx scripts/verify-complimentary-esim-bulk.ts
 *   npx tsx scripts/verify-complimentary-esim-bulk.ts --execute
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

const BASE_URL = (process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function adminFetchHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const bypass = (process.env.DEV_ADMIN_BYPASS_SECRET ?? process.env.ADMIN_BYPASS_SECRET ?? "").trim();
  if (bypass) headers.Cookie = `admin_bypass=${encodeURIComponent(bypass)}`;
  return headers;
}

function fail(msg: string): never {
  console.error(`\n[FAIL] ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`[ok] ${msg}`);
}

function runUnitTests() {
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", "lib/bongsim/admin/complimentary-esim-order.test.ts"],
    { stdio: "inherit", cwd: process.cwd(), shell: process.platform === "win32" },
  );
  if (r.status !== 0) fail("vitest complimentary-esim-order.test.ts failed");
  ok("vitest — phone parsing + bulk cap");
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...adminFetchHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body: body as Record<string, unknown> };
}

async function pickOptionApiId(): Promise<string> {
  const { res, body } = await fetchJson(
    `${BASE_URL}/api/admin/bongsim/complimentary-esim/plans?country=jp&days=7`,
  );
  if (res.status === 401) {
    fail(
      "plans API 401 — dev server에서 ALLOW_MOCK_ADMIN=true·NODE_ENV=development 필요 (또는 관리자 세션)",
    );
  }
  if (!res.ok) fail(`plans API ${res.status}: ${String(body.error ?? "unknown")}`);
  const plans = body.plans as Array<{ option_api_id?: string }> | undefined;
  const id = plans?.[0]?.option_api_id?.trim();
  if (!id) fail("plans API returned no eSIM options");
  return id;
}

function makePhonePair(suffix: string): [string, string] {
  return [`0107777${suffix}`, `0107788${suffix}`];
}

async function executeLiveBulk(optionApiId: string, phones: [string, string], label: string) {
  const { res, body } = await fetchJson(`${BASE_URL}/api/admin/bongsim/complimentary-esim/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      option_api_id: optionApiId,
      reason_category: "group_benefit",
      reason_memo: `${label} ${new Date().toISOString()}`,
      phones_text: `${phones[0]}\ninvalid-phone\n${phones[1]}`,
    }),
  });
  if (res.status === 401) fail("bulk API 401 — dev server admin mock/session 필요");
  if (!res.ok) fail(`bulk API ${res.status}: ${String(body.message ?? body.error ?? "unknown")}`);
  if (body.ok !== true) fail("bulk API ok !== true");
  if (body.succeeded !== 2) fail(`bulk API succeeded=${body.succeeded}, expected 2`);
  if ((body.failed as number | undefined) !== 0) fail(`bulk API failed=${body.failed}, expected 0`);
  const invalid = body.invalid_phones as string[] | undefined;
  if (!invalid || invalid.length !== 1) fail(`bulk API invalid_phones=${invalid?.length ?? 0}, expected 1`);
  ok(`${label} — HTTP 2 succeeded, 1 invalid skipped`);
  return body.results as Array<{ ok?: boolean; order_number?: string; phone?: string }>;
}

async function verifyOrdersInDb(orderNumbers: string[]) {
  for (const orderNumber of orderNumbers) {
    const { res, body } = await fetchJson(
      `${BASE_URL}/api/admin/bongsim/payments?search=${encodeURIComponent(orderNumber)}&page=1`,
    );
    if (!res.ok) fail(`payments list API ${res.status} for ${orderNumber}`);
    const orders = body.orders as Array<{ order_number?: string; checkout_channel?: string }> | undefined;
    const hit = orders?.find((o) => o.order_number === orderNumber);
    if (!hit) fail(`payments list: order ${orderNumber} not found`);
    if (hit.checkout_channel !== "admin_complimentary_esim") {
      fail(`payments list: ${orderNumber} checkout_channel=${hit.checkout_channel}`);
    }
  }
  ok(`payments API post-check — ${orderNumbers.length} complimentary orders visible`);
}

async function main() {
  const execute = process.argv.includes("--execute");

  console.log("=== verify-complimentary-esim-bulk ===\n");

  runUnitTests();

  if (!execute) {
    console.log("\n[skip] live HTTP+DB (pass --execute; dev server on localhost:3000)");
    console.log("PASSED: unit checks only");
    return;
  }

  try {
    const ping = await fetch(`${BASE_URL}/api/auth/session`, { cache: "no-store" });
    if (!ping.ok && ping.status !== 401) {
      fail(`dev server unreachable at ${BASE_URL} (session probe ${ping.status})`);
    }
  } catch {
    fail(`dev server unreachable at ${BASE_URL} — npm run dev 실행 후 재시도`);
  }
  ok(`dev server reachable (${BASE_URL})`);

  const optionApiId = await pickOptionApiId();
  ok(`catalog option via HTTP: ${optionApiId}`);

  const suffix = String(Date.now() % 10000).padStart(4, "0");
  const phones = makePhonePair(suffix);
  console.log(`[info] test phones: ${phones.join(", ")} (검증용 — 알림톡·USIMSA 시도 가능)`);

  const results = await executeLiveBulk(optionApiId, phones, "verify-bulk-http");
  const orderNumbers = results.filter((r) => r.ok).map((r) => r.order_number).filter(Boolean);
  if (orderNumbers.length !== 2) fail(`bulk results missing order_number (${orderNumbers.length}/2)`);
  ok(`bulk result order_numbers: ${orderNumbers.join(", ")}`);

  await verifyOrdersInDb(orderNumbers);

  console.log("\nPASSED: complimentary eSIM bulk real verification (HTTP + DB)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
