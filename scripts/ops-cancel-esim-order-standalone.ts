#!/usr/bin/env tsx
/**
 * eSIM 주문 카드 취소(운영) — lib/server-only 의존 없이 PG·유심사·DB 직접 처리
 *
 *   npx tsx scripts/ops-cancel-esim-order-standalone.ts BS-20260609-DF1C7205 --tid <승인TID>
 *   npx tsx scripts/ops-cancel-esim-order-standalone.ts BS-20260609-DF1C7205 --mark-cancelled  # PG 미승인·미결제만 DB 취소
 */
import { createHash, createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import { createUsimsaSignature, createUsimsaTimestamp } from "../lib/usimsa/signature";
import { resolveSecretKey } from "../lib/usimsa/resolve-secret-key";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local", override: true });
else if (existsSync(".env")) loadDotenv({ path: ".env", override: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim() || undefined;
}

const ORDER_KEY =
  process.argv.slice(2).find((a) => !a.startsWith("-") && !a.endsWith(".ts")) ?? "";
const TID = arg("--tid");
const MARK_ONLY = process.argv.includes("--mark-cancelled");

function welcomepayEnv(): "production" | "test" {
  const raw = (process.env.WELCOMEPAY_ENV ?? "").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  if (process.env.NODE_ENV === "production") return "production";
  return "test";
}

function cancelUrl(): string {
  const base =
    welcomepayEnv() === "production"
      ? "https://payapi.paywelcome.co.kr"
      : "https://tpayapi.paywelcome.co.kr";
  return `${base}/cancel/cancel`;
}

function tsKst(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(/[-\s:]/g, "");
}

async function usimsaFetch(method: "GET" | "POST", path: string): Promise<Record<string, unknown>> {
  const accessKey = (process.env.USIMSA_ACCESS_KEY ?? "").trim();
  const { secretKey } = resolveSecretKey(welcomepayEnv() === "production" ? "production" : "development");
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

async function welcomepayCancel(tid: string, priceKrw: number): Promise<{ ok: boolean; raw: string }> {
  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const signKey = (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
  const timestamp = tsKst();
  const mk = createHash("sha256").update(signKey, "utf8").digest("hex");
  const sig = createHash("sha256")
    .update(`mid=${mid}&mkey=${mk}&timestamp=${timestamp}`, "utf8")
    .digest("hex");
  const body = new URLSearchParams({
    payType: "card",
    mid,
    tid,
    price: String(priceKrw),
    currency: "WON",
    timestamp,
    signature: sig,
  });
  const res = await fetch(cancelUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  const raw = await res.text();
  const ok = /resultCode=00|ResultCode=0000|"resultCode":"00"/i.test(raw) || raw.includes("00");
  return { ok: res.ok && ok, raw };
}

async function main() {
  const key = ORDER_KEY.trim();
  if (!key) {
    console.error("Usage: ... <order_number> [--tid TID] [--mark-cancelled]");
    process.exit(1);
  }

  const c = new Client({ connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=[^&]*/gi, "") });
  await c.connect();

  const isUuid = /^[0-9a-f-]{36}$/i.test(key);
  const o = await c.query<{
    order_id: string;
    order_number: string;
    status: string;
    grand_total_krw: string;
    payment_reference: string | null;
    payment_provider: string | null;
    payment_attempt_id: string | null;
  }>(
    `SELECT o.order_id::text, o.order_number, o.status, o.grand_total_krw::text,
            o.payment_reference, o.payment_provider,
            (SELECT payment_attempt_id::text FROM bongsim_payment_attempt pa
              WHERE pa.order_id = o.order_id AND pa.provider = 'welcomepay'
              ORDER BY pa.created_at DESC LIMIT 1) AS payment_attempt_id
     FROM bongsim_order o
     WHERE ${isUuid ? "o.order_id = $1::uuid" : "o.order_number ILIKE $1"}`,
    [key],
  );
  const order = o.rows[0];
  if (!order) {
    console.error("주문 없음");
    process.exit(1);
  }

  const tops = await c.query<{ topup_id: string; status: string }>(
    `SELECT topup_id, status FROM bongsim_fulfillment_topup
     WHERE order_id = $1::uuid AND supplier_id = 'usimsa' AND status NOT IN ('canceled','failed')`,
    [order.order_id],
  );

  console.log("주문:", order);
  console.log("active topups:", tops.rows);

  if (order.status === "refunded") {
    console.log("이미 환불됨");
    await c.end();
    return;
  }

  if (MARK_ONLY) {
    await c.query(`UPDATE bongsim_order SET status = 'cancelled', updated_at = now() WHERE order_id = $1::uuid`, [
      order.order_id,
    ]);
    console.log("DB만 cancelled 처리 (PG 호출 없음)");
    await c.end();
    return;
  }

  let tid = (TID ?? order.payment_reference ?? "").trim();
  const price = Number.parseInt(order.grand_total_krw, 10);

  if (!tid) {
    console.error(
      "승인 TID 없음. 웰컴페이먼츠 가맹점 콘솔에서 MOID",
      "(provider_session_id)",
      "승인 TID 확인 후 --tid 로 재실행하세요.",
    );
    const pa = await c.query(`SELECT provider_session_id FROM bongsim_payment_attempt WHERE order_id = $1::uuid`, [
      order.order_id,
    ]);
    console.log("PG MOID(oid):", pa.rows[0]?.provider_session_id ?? "(none)");
    process.exit(1);
  }

  for (const t of tops.rows) {
    const mb = await usimsaUsageMb(t.topup_id);
    console.log(`usage ${t.topup_id}: ${mb} MB`);
    if (mb > 0.01) {
      console.error("데이터 사용됨 — 취소 불가");
      process.exit(1);
    }
    const cancelRes = await usimsaFetch("POST", `/v2/cancel/${encodeURIComponent(t.topup_id)}`);
    console.log("usimsa cancel", t.topup_id, cancelRes);
    const code = String(cancelRes.code ?? "");
    if (code !== "0000" && code !== "9002") {
      console.error("유심사 취소 실패");
      process.exit(1);
    }
    await c.query(
      `UPDATE bongsim_fulfillment_topup SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
       WHERE topup_id = $1`,
      [t.topup_id],
    );
  }

  const pg = await welcomepayCancel(tid, price);
  console.log("welcomepay cancel:", pg);
  if (!pg.ok) {
    console.error("PG 취소 실패 — topup은 이미 취소됐을 수 있음. 수동 확인 필요.");
    process.exit(1);
  }

  if (order.status === "awaiting_payment") {
    await c.query(
      `UPDATE bongsim_order SET status = 'refunded', paid_at = COALESCE(paid_at, now()),
       payment_reference = $2, paid_amount_krw = $3, payment_provider = 'welcomepay', updated_at = now()
       WHERE order_id = $1::uuid`,
      [order.order_id, tid, price],
    );
  } else {
    await c.query(`UPDATE bongsim_order SET status = 'refunded', updated_at = now() WHERE order_id = $1::uuid`, [
      order.order_id,
    ]);
  }

  if (order.payment_attempt_id) {
    await c.query(`UPDATE bongsim_payment_attempt SET status = 'refunded', updated_at = now() WHERE payment_attempt_id = $1::uuid`, [
      order.payment_attempt_id,
    ]);
  }

  console.log("완료: refunded");
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
