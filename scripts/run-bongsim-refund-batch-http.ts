#!/usr/bin/env tsx
/** localhost 관리자 환불 API 일괄 호출 (.env.local 로드) */
import { existsSync } from "node:fs";
import { config } from "dotenv";

if (existsSync(".env.local")) config({ path: ".env.local", override: true });
if (existsSync(".env")) config({ path: ".env", override: true });

const BASE = (process.env.REFUND_API_BASE ?? "http://localhost:3000").replace(/\/$/, "");

const ORDER_IDS = [
  { id: "bf2efd5d-d0ad-49a7-9e58-7ed2e79e6fbe", num: "BS-20260522-E890E0A9" },
  { id: "0365d407-002f-4f81-a6b8-4d8a338d1cbb", num: "BS-20260522-B6F41189" },
  { id: "436b891d-e5d1-470c-93ba-62456de28269", num: "BS-20260522-2EE5848F" },
  { id: "b1a794fa-8190-461b-a89e-f81a121d7489", num: "BS-20260522-6A9743C7" },
  { id: "e9e6259b-96ba-457f-892c-3a04a498efc3", num: "BS-20260522-9312B2A2" },
];

function asciiBearerSecret(): string {
  for (const name of ["ADMIN_SERVICE_BEARER_SECRET", "ADMIN_BYPASS_SECRET", "DEV_ADMIN_BYPASS_SECRET"]) {
    const v = (process.env[name] ?? "").trim();
    if (!v) continue;
    if ([...v].every((ch) => ch.charCodeAt(0) <= 255)) return v;
  }
  return "";
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const bearer = asciiBearerSecret();
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  const bypass = (process.env.ADMIN_BYPASS_SECRET ?? process.env.DEV_ADMIN_BYPASS_SECRET ?? "").trim();
  if (bypass) h.Cookie = `admin_bypass=${bypass}`;
  return h;
}

async function main() {
  console.log("[base]", BASE);
  console.log("[auth]", {
    bearer: Boolean((process.env.ADMIN_SERVICE_BEARER_SECRET ?? "").trim()),
    bypassCookie: Boolean((process.env.ADMIN_BYPASS_SECRET ?? "").trim()),
  });

  let failed = 0;
  for (const o of ORDER_IDS) {
    console.log(`\n--- ${o.num} ---`);
    const res = await fetch(`${BASE}/api/admin/bongsim/refund`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ orderId: o.id, reason: "운영 일괄 환불" }),
    });
    const text = await res.text();
    let json: unknown = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* raw */
    }
    console.log(`  HTTP ${res.status}`, json);
    if (!res.ok) failed += 1;
    await new Promise((r) => setTimeout(r, 1500));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
