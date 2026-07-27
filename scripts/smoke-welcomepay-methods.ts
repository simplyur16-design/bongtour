#!/usr/bin/env tsx
/**
 * 웰컴페이먼츠 다중 결제수단 스모크 테스트
 * npx tsx scripts/smoke-welcomepay-methods.ts [--base https://bongtour.com]
 */
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import { listWelcomepayCheckoutMethods } from "../lib/bongsim/welcomepay-payment-methods";
import { listWelcomepayEasyPayCheckoutDefinitions } from "../lib/bongsim/welcomepay-easy-pay";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local" });
else if (existsSync(".env")) loadDotenv({ path: ".env" });

const base = (process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

async function httpSmoke() {
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  const vbank = await fetch(`${base}/api/bongsim/checkout/welcomepay-vbank-noti`);
  const vbankBody = (await vbank.text()).trim();
  checks.push({
    name: "vbank-noti GET",
    ok: vbank.status === 200 && (vbankBody === "IGNORED" || vbankBody === "OK"),
    detail: `${vbank.status} ${vbankBody}`,
  });

  const prepEmpty = await fetch(`${base}/api/bongsim/checkout/welcomepay-prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const prepEmptyJson = (await prepEmpty.json().catch(() => ({}))) as { error?: string };
  checks.push({
    name: "prepare route alive",
    ok: prepEmpty.status === 400 && prepEmptyJson.error === "missing_fields",
    detail: `${prepEmpty.status} ${prepEmptyJson.error ?? ""}`,
  });

  return checks;
}

async function findPayableOrder(): Promise<{
  orderId: string;
  orderNumber: string;
  welcomeOid: string;
  amount: number;
  customerEmail: string;
  paymentAttemptId: string;
} | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  const c = new Client({
    connectionString: url.replace(/[?&]sslmode=[^&]*/gi, ""),
    connectionTimeoutMillis: 12_000,
    query_timeout: 12_000,
  });
  try {
    await c.connect();
    const r = await c.query<{
      order_id: string;
      order_number: string;
      grand_total_krw: string;
      buyer_email: string;
      payment_attempt_id: string;
      provider_session_id: string | null;
    }>(
      `SELECT o.order_id, o.order_number, o.grand_total_krw::text, o.buyer_email,
              pa.payment_attempt_id, pa.provider_session_id
       FROM bongsim_order o
       JOIN bongsim_payment_attempt pa ON pa.order_id = o.order_id
       WHERE o.status = 'awaiting_payment' AND pa.provider = 'welcomepay'
       ORDER BY o.created_at DESC
       LIMIT 1`,
    );
    const row = r.rows[0];
    if (!row?.provider_session_id) return null;
    const amount = Number.parseInt(row.grand_total_krw, 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      orderId: row.order_id,
      orderNumber: row.order_number,
      welcomeOid: row.provider_session_id,
      amount,
      customerEmail: row.buyer_email,
      paymentAttemptId: row.payment_attempt_id,
    };
  } catch (e) {
    console.warn("[smoke] DB skip:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

async function prepareSmoke(order: NonNullable<Awaited<ReturnType<typeof findPayableOrder>>>) {
  const res = await fetch(`${base}/api/bongsim/checkout/welcomepay-prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order.orderId,
      orderNumber: order.welcomeOid,
      amount: order.amount,
      orderName: "Bong투어 eSIM smoke",
      customerEmail: order.customerEmail,
      paymentAttemptId: order.paymentAttemptId,
      paymentMethod: "vbank",
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    methods?: { id: string; mobile: { submitUrl: string; pIniPayment: string } }[];
    pNotiUrl?: string;
    mobile?: { submitUrl: string; pIniPayment: string };
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, detail: `${res.status} ${data.error ?? "prepare_failed"}` };
  }
  const ids = (data.methods ?? []).map((m) => m.id).sort();
  const expected = [
    ...listWelcomepayCheckoutMethods().map((m) => m.id),
    ...listWelcomepayEasyPayCheckoutDefinitions().map((m) => m.id),
  ].sort();
  const urlsOk = (data.methods ?? []).every((m) => m.mobile.submitUrl.includes(`/smart/`));
  const vbank = data.methods?.find((m) => m.id === "vbank");
  const pNoti = Boolean(data.pNotiUrl?.includes("welcomepay-vbank-noti"));
  const vbankUrl = vbank?.mobile.submitUrl.includes("/smart/vbank/");
  const ok =
    JSON.stringify(ids) === JSON.stringify(expected) &&
    urlsOk &&
    pNoti &&
    vbankUrl &&
    data.mobile?.pIniPayment === "VBANK";
  return {
    ok,
    detail: ok
      ? `methods=${ids.join(",")} pNotiUrl=ok vbank=${vbank?.mobile.submitUrl}`
      : `ids=${ids.join(",")} expected=${expected.join(",")} pNoti=${pNoti} vbankUrl=${vbankUrl}`,
  };
}

async function main() {
  console.log(`\n[smoke] base=${base}\n`);
  const http = await httpSmoke();
  for (const c of http) {
    console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`);
  }

  const order = await findPayableOrder();
  if (!order) {
    console.log("\nSKIP prepare(full): awaiting_payment welcomepay 주문 없음 또는 DB 연결 불가");
    const failed = http.some((c) => !c.ok);
    process.exit(failed ? 1 : 0);
  }

  console.log(`\n[smoke] order=${order.orderNumber} amount=${order.amount}`);
  const prep = await prepareSmoke(order);
  console.log(`${prep.ok ? "PASS" : "FAIL"} prepare methods: ${prep.detail}`);

  const failed = http.some((c) => !c.ok) || !prep.ok;
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
