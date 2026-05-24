#!/usr/bin/env tsx
/**
 * 환불 가능 주문 일괄 실행 (.env.local 우선, override)
 * npx tsx scripts/run-bongsim-refund-batch.ts
 * npx tsx scripts/run-bongsim-refund-batch.ts --order-id <uuid> ...
 */
import { existsSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";

register(pathToFileURL(join(process.cwd(), "scripts/stub-server-only.mjs")).href);

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

const DEFAULT_ORDER_IDS = [
  "bf2efd5d-d0ad-49a7-9e58-7ed2e79e6fbe",
  "0365d407-002f-4f81-a6b8-4d8a338d1cbb",
  "436b891d-e5d1-470c-93ba-62456de28269",
  "b1a794fa-8190-461b-a89e-f81a121d7489",
  "e9e6259b-96ba-457f-892c-3a04a498efc3",
];

function orderIdsFromArgv(): string[] {
  const ids: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--order-id" && argv[i + 1]) {
      ids.push(argv[i + 1]!.trim());
      i += 1;
    }
  }
  return ids;
}

async function main() {
  const { getPgPool, probePgPoolTlsOrFallback } = await import("../lib/bongsim/db/pool");
  const { processRefund } = await import("../lib/bongsim/refund/process-refund");

  const envCheck = {
    WELCOMEPAY_MID: Boolean((process.env.WELCOMEPAY_MID ?? "").trim()),
    WELCOMEPAY_SIGN_KEY: Boolean((process.env.WELCOMEPAY_SIGN_KEY ?? "").trim()),
    USIMSA_ACCESS_KEY: Boolean((process.env.USIMSA_ACCESS_KEY ?? "").trim()),
    USIMSA_SECRET_KEY: Boolean(
      (process.env.USIMSA_SECRET_KEY ?? process.env.USIMSA_PROD_SECRET_KEY ?? "").trim(),
    ),
  };
  console.log("[env]", envCheck);

  if (!(await probePgPoolTlsOrFallback())) {
    console.error("DB 연결 실패");
    process.exit(1);
  }

  const pool = getPgPool();
  if (!pool) {
    console.error("pool 없음");
    process.exit(1);
  }

  const orderIds = orderIdsFromArgv().length > 0 ? orderIdsFromArgv() : DEFAULT_ORDER_IDS;
  const results: Array<{ orderId: string; orderNumber?: string; ok: boolean; detail: unknown }> = [];

  for (const orderId of orderIds) {
    const meta = await pool.query<{ order_number: string; status: string }>(
      `SELECT order_number, status FROM bongsim_order WHERE order_id = $1::uuid`,
      [orderId],
    );
    const row = meta.rows[0];
    console.log(`\n--- 환불 시작 ${row?.order_number ?? "?"} (${orderId}) status=${row?.status ?? "?"}`);

    const result = await processRefund(orderId, "운영 일괄 환불 (run-bongsim-refund-batch)", {
      kind: "admin",
      id: "refund-batch-script",
    });

    const after = await pool.query<{ status: string }>(
      `SELECT status FROM bongsim_order WHERE order_id = $1::uuid`,
      [orderId],
    );

    console.log("  result:", result);
    console.log("  status after:", after.rows[0]?.status ?? "(missing)");

    results.push({
      orderId,
      orderNumber: row?.order_number,
      ok: result.ok,
      detail: result.ok ? "refunded" : result,
    });

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("\n=== 요약 ===");
  for (const r of results) {
    console.log(`  ${r.ok ? "OK" : "FAIL"}  ${r.orderNumber ?? r.orderId}  ${JSON.stringify(r.detail)}`);
  }

  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
