#!/usr/bin/env tsx
/**
 * 웰컴페이먼츠 가상계좌 연동 점검 — prepare 페이로드·콜백 URL·wbiz 확인 항목.
 * npx tsx scripts/diagnose-welcomepay-vbank.ts [--base https://bongtour.com]
 */
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";
import {
  buildWelcomepayMobileReserved,
  buildWelcomepayPcAcceptMethod,
  getWelcomepayMethodDefinition,
} from "../lib/bongsim/welcomepay-payment-methods";

if (existsSync(".env.local")) loadDotenv({ path: ".env.local" });
else if (existsSync(".env")) loadDotenv({ path: ".env" });

const base = (process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "https://bongtour.com").replace(
  /\/$/,
  "",
);

async function findPayableOrder() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/gi, "") });
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
       ORDER BY o.created_at DESC LIMIT 1`,
    );
    const row = r.rows[0];
    if (!row?.provider_session_id) return null;
    const amount = Number.parseInt(row.grand_total_krw, 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      orderId: row.order_id,
      welcomeOid: row.provider_session_id,
      amount,
      customerEmail: row.buyer_email,
      paymentAttemptId: row.payment_attempt_id,
    };
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const vbankDef = getWelcomepayMethodDefinition("vbank");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "(unset)").trim();
  const welEnv = (process.env.WELCOMEPAY_ENV ?? "(unset)").trim();
  const mid = (process.env.WELCOMEPAY_MID ?? "").trim();
  const pNotiExpected = `${siteUrl.replace(/\/$/, "")}/api/bongsim/checkout/welcomepay-vbank-noti`;

  console.log("\n=== 웰컴페이 가상계좌 진단 ===\n");
  console.log("[서버 env]");
  console.log(`  WELCOMEPAY_MID: ${mid ? `${mid.slice(0, 4)}…` : "MISSING"}`);
  console.log(`  WELCOMEPAY_ENV: ${welEnv}`);
  console.log(`  NEXT_PUBLIC_SITE_URL: ${siteUrl}`);
  console.log(`  P_NOTI_URL (모바일·등록 기대값): ${pNotiExpected}`);

  console.log("\n[코드가 PG에 보내는 가상계좌 파라미터]");
  console.log(`  PC gopaymethod: ${vbankDef.pcGoPayMethod}`);
  console.log(`  PC acceptmethod: ${buildWelcomepayPcAcceptMethod("vbank")}`);
  console.log(`  Mobile URL path: /smart/${vbankDef.mobilePath}/`);
  console.log(`  Mobile P_INI_PAYMENT: ${vbankDef.pIniPayment}`);
  console.log(`  Mobile P_RESERVED: ${buildWelcomepayMobileReserved(vbankDef, false)}`);

  const notiRes = await fetch(`${base}/api/bongsim/checkout/welcomepay-vbank-noti`);
  const notiBody = (await notiRes.text()).trim();
  console.log("\n[입금통보 엔드포인트]");
  console.log(`  GET ${base}/api/bongsim/checkout/welcomepay-vbank-noti → ${notiRes.status} ${notiBody}`);
  console.log("  (브라우저 GET의 IGNORED는 정상 — PG 입금 POST만 처리)");

  const order = await findPayableOrder();
  if (!order) {
    console.log("\n[prepare 실측] SKIP — awaiting_payment welcomepay 주문 없음");
  } else {
    const res = await fetch(`${base}/api/bongsim/checkout/welcomepay-prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...order,
        orderNumber: order.welcomeOid,
        orderName: "Bong투어 eSIM vbank diag",
        paymentMethod: "vbank",
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      welcomepay_env?: string;
      pNotiUrl?: string;
      methods?: { id: string; mobile: { submitUrl: string; pReserved: string }; pc: { acceptMethod: string } }[];
      error?: string;
    };
    const vbank = data.methods?.find((m) => m.id === "vbank");
    console.log("\n[prepare 실측 — 운영 API]");
    console.log(`  HTTP ${res.status} ok=${data.ok} welcomepay_env=${data.welcomepay_env ?? "?"}`);
    if (!data.ok) {
      console.log(`  error: ${data.error ?? "unknown"}`);
    } else {
      console.log(`  pNotiUrl: ${data.pNotiUrl ?? "(none)"}`);
      console.log(`  pNotiUrl match: ${data.pNotiUrl === pNotiExpected ? "YES" : "NO — wbiz 등록 URL과 불일치 가능"}`);
      console.log(`  vbank mobile submit: ${vbank?.mobile.submitUrl ?? "(none)"}`);
      console.log(`  vbank mobile P_RESERVED: ${vbank?.mobile.pReserved ?? "(none)"}`);
      console.log(`  vbank pc acceptMethod: ${vbank?.pc.acceptMethod ?? "(none)"}`);
    }
  }

  console.log(`
[은행선택이 비어 있을 때 — 웰컴 wbiz 확인 (코드 밖)]
  1. wbiz.paywelcome.co.kr → 해당 운영 MID 선택
  2. 가상계좌 메뉴 → 서비스 상태가 「개시」인지 (신청만 되고 개시 전이면 은행 없음)
  3. 가상계좌 → 「채번 가능 은행」에 국민·신한·우리 등 1개 이상 체크돼 있는지
     ※ 입금통보 URL만 넣고 채번 은행을 안 고르면 결제창 은행 목록이 비어 있음
  4. 입금통보: 「URL 수신」 선택 + URL = ${pNotiExpected}
  5. WELCOMEPAY_ENV=production + 운영 MID/signKey 쌍이 서버 .env와 wbiz MID가 동일한지

[웰컴 테스트 안내]
  https://www.welcomepayments.co.kr/helpdesk/inform — 테스트 MID welcometst는
  저축은행·신한은행 채번 예시가 있음. 운영 MID는 영업/고객센터(1661-0948)로 채번은행 개시 요청.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
