#!/usr/bin/env tsx
/**
 * 무상 eSIM — 지정 번호 제외 complimentary 주문 USIMSA 취소 + refunded
 *   npx tsx scripts/ops-cancel-complimentary-esim-except.ts --dry-run
 *   npx tsx scripts/ops-cancel-complimentary-esim-except.ts --execute
 */
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import { createUsimsaSignature, createUsimsaTimestamp } from "../lib/usimsa/signature";
import { resolveSecretKey } from "../lib/usimsa/resolve-secret-key";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

const KEEP_PHONES = [
  "01094384518",
  "01099024518",
  "01088984832",
  "01068284832",
  "01048765172",
  "01042050919",
  "01085980898",
  "01066695295",
  "01025447026",
  "01050557026",
];

const dryRun = process.argv.includes("--dry-run");
const execute = process.argv.includes("--execute");

function welcomepayEnv(): "production" | "test" {
  const raw = (process.env.WELCOMEPAY_ENV ?? "").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  if (process.env.NODE_ENV === "production") return "production";
  return "production";
}

async function usimsaFetch(method: "GET" | "POST", path: string): Promise<Record<string, unknown>> {
  const accessKey = (process.env.USIMSA_ACCESS_KEY ?? "").trim();
  const { secretKey } = resolveSecretKey(welcomepayEnv());
  const host =
    welcomepayEnv() === "production" ? "https://open-api.usimsa.com" : "https://dev-open-api.usimsa.com";
  const pathAndQuery = `/api${path.startsWith("/") ? path : `/${path}`}`;
  const timestamp = createUsimsaTimestamp();
  const signature = createUsimsaSignature({
    method,
    pathAndQuery,
    timestamp,
    accessKey,
    secretKey,
  });
  const res = await fetch(`${host}${pathAndQuery}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-gat-access-key": accessKey,
      "x-gat-timestamp": timestamp,
      "x-gat-signature": signature,
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { code: "parse", message: text.slice(0, 200) };
  }
}

async function usimsaUsageMb(topupId: string): Promise<number> {
  const raw = await usimsaFetch("GET", `/v2/topup/${encodeURIComponent(topupId)}/usage/daily`);
  const usage = raw.usage;
  if (!usage || typeof usage !== "object") return 0;
  const history = (usage as { history?: unknown }).history;
  if (!Array.isArray(history)) return 0;
  let sum = 0;
  for (const row of history) {
    if (!row || typeof row !== "object") continue;
    const mb = Number.parseFloat(String((row as { usageMb?: unknown }).usageMb ?? "0"));
    if (Number.isFinite(mb)) sum += mb;
  }
  return sum;
}

async function pgClient() {
  const url = process.env.DATABASE_URL?.trim()?.replace(/[?&]sslmode=[^&]*/gi, "") ?? "";
  if (!url) throw new Error("DATABASE_URL 없음");
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

async function main() {
  if (!dryRun && !execute) {
    console.error("Usage: ... --dry-run | --execute");
    process.exit(1);
  }

  const c = await pgClient();
  try {
    const targets = await c.query<{
      order_id: string;
      order_number: string;
      buyer_tel: string;
      status: string;
      reason_memo: string | null;
      created_at: Date;
    }>(
      `SELECT o.order_id::text AS order_id, o.order_number, o.buyer_tel, o.status,
              o.consents->'complimentary_esim'->>'reason_memo' AS reason_memo,
              o.created_at
         FROM bongsim_order o
        WHERE o.checkout_channel = 'admin_complimentary_esim'
          AND NOT (o.buyer_tel = ANY($1::text[]))
          AND o.status IN ('paid', 'delivered', 'refund_requested')
        ORDER BY o.created_at ASC`,
      [KEEP_PHONES],
    );

    console.log(`대상: ${targets.rows.length}건 (유지 ${KEEP_PHONES.length}개 번호 제외)\n`);
    if (targets.rows.length === 0) {
      console.log("취소할 무상 eSIM 주문 없음");
      return;
    }

    for (const row of targets.rows) {
      console.log(
        `${row.order_number} | ${row.buyer_tel} | ${row.status} | ${row.created_at.toISOString()} | ${(row.reason_memo ?? "").slice(0, 50)}`,
      );
    }

    if (dryRun) {
      console.log("\n[dry-run] USIMSA 취소·refunded 미실행");
      return;
    }

    let ok = 0;
    let fail = 0;
    for (const row of targets.rows) {
      console.log(`\n--- ${row.order_number} (${row.buyer_tel}) ---`);
      try {
        const tops = await c.query<{ topup_id: string }>(
          `SELECT topup_id FROM bongsim_fulfillment_topup
            WHERE order_id = $1::uuid AND supplier_id = 'usimsa'
              AND status NOT IN ('canceled', 'failed')`,
          [row.order_id],
        );

        for (const t of tops.rows) {
          const mb = await usimsaUsageMb(t.topup_id);
          console.log(`  usage ${t.topup_id}: ${mb} MB`);
          if (mb > 0.01) throw new Error(`데이터 사용됨 (${mb} MB)`);
          const cancelRes = await usimsaFetch("POST", `/v2/cancel/${encodeURIComponent(t.topup_id)}`);
          const code = String(cancelRes.code ?? "");
          console.log("  usimsa cancel", t.topup_id, code, String(cancelRes.message ?? ""));
          if (code !== "0000" && code !== "9002") {
            throw new Error(`usimsa cancel failed code=${code}`);
          }
          await c.query(
            `UPDATE bongsim_fulfillment_topup
                SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
              WHERE topup_id = $1`,
            [t.topup_id],
          );
        }

        await c.query(`UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`, [
          row.order_id,
        ]);
        console.log("  OK → refunded");
        ok += 1;
      } catch (e) {
        console.error("  FAIL:", e instanceof Error ? e.message : e);
        fail += 1;
      }
    }

    console.log(`\n완료: 성공 ${ok} / 실패 ${fail} / 대상 ${targets.rows.length}`);
    process.exit(fail > 0 ? 1 : 0);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
