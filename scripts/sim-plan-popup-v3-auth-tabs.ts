/**
 * hasBinaryAuthDistribution + 탭/안내박스 시뮬 (read-only)
 * Usage: npx tsx scripts/sim-plan-popup-v3-auth-tabs.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import {
  getKycLabelDistribution,
  hasBinaryAuthDistribution,
} from "../lib/bongsim/esim/kyc-required";
import { filterPlanGroupsByTripDaysWindow } from "../lib/bongsim/recommend/plan-display-filter";

type Row = { flags?: Record<string, unknown> };

const CASES = [
  { label: "대만 4일", q: "country=tw&days=4" },
  { label: "대만 3일", q: "country=tw&days=3" },
  { label: "대만 8일", q: "country=tw&days=8" },
  { label: "일본 3일", q: "country=jp&days=3" },
  { label: "일본 8일", q: "country=jp&days=8" },
  { label: "베트남 3일", q: "country=vn&days=3" },
  { label: "베트남 8일", q: "country=vn&days=8" },
  { label: "중국 단독 5일", q: "country=cn&days=5" },
  { label: "홍콩 4일", q: "country=hk&days=4" },
  { label: "홍콩+마카오 8일", q: "country=hk&days=8&codes=hk,mo" },
];

async function main() {
  const base = process.env.SIM_BASE_URL ?? "http://localhost:3000";
  for (const c of CASES) {
    const res = await fetch(`${base}/api/bongsim/products/plans?${c.q}`);
    if (!res.ok) {
      console.log(`\n=== ${c.label} === HTTP ${res.status}`);
      continue;
    }
    const json = (await res.json()) as {
      kyc_distribution?: string;
      trip_days?: number;
      matched_days?: number;
      groups?: { unlimited?: Row[]; daily?: Row[]; fixed?: Row[] };
    };
    const all = [
      ...(json.groups?.unlimited ?? []),
      ...(json.groups?.daily ?? []),
      ...(json.groups?.fixed ?? []),
    ];
    const binaryFn = hasBinaryAuthDistribution(all);
    const dist = getKycLabelDistribution(all);
    const trip = json.trip_days ?? "—";
    const matched = json.matched_days ?? trip;
    const notice =
      matched !== trip ? `${trip}일 여정 → ${matched}일 플랜 (무제한·데일리 탭만)` : "안내 없음";
    const windowed = filterPlanGroupsByTripDaysWindow(
      {
        unlimited: (json.groups?.unlimited ?? []) as never[],
        daily: (json.groups?.daily ?? []) as never[],
        fixed: (json.groups?.fixed ?? []) as never[],
      },
      Number(trip) || 1,
    );
    console.log(`\n=== ${c.label} ===`);
    console.log(
      `  kyc_distribution=${dist} | hasBinaryAuthDistribution=${binaryFn} | toggle=${binaryFn ? "O" : "X"}`,
    );
    console.log(
      `  tabs(±2/fixed전체): u=${windowed.unlimited.length} d=${windowed.daily.length} f=${windowed.fixed.length}`,
    );
    console.log(`  dayNotice(unlimited/daily only): ${notice}`);
    console.log(`  fixedTab dayNotice: X (always hidden on fixed tab)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
