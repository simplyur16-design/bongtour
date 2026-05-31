/**
 * ±2일 표시 범위 + 섹션 건수 시뮬 (대만·홍콩 X·O)
 * Usage: npx tsx scripts/sim-plan-popup-grid.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getKycLabelState } from "../lib/bongsim/esim/kyc-required";
import { filterPlanGroupsByTripDaysWindow } from "../lib/bongsim/recommend/plan-display-filter";
import { catalogDayOf } from "../lib/bongsim/recommend/plan-display-filter";
import { sortPlanGroupsForDisplay } from "../lib/bongsim/recommend/plan-display-sort";
import { extractDaysFromDaysRaw } from "../lib/bongsim/recommend/product-option";
import type { ProductOption } from "../lib/bongsim/recommend/product-option";

type PlanGroups = { unlimited: ProductOption[]; daily: ProductOption[]; fixed: ProductOption[] };

function filterAuth(groups: PlanGroups, auth: "required" | "not_required"): PlanGroups {
  const match = (p: ProductOption) => {
    const s = getKycLabelState(p.flags);
    return auth === "required" ? s === "required" : s === "not_required";
  };
  return {
    unlimited: groups.unlimited.filter(match),
    daily: groups.daily.filter(match),
    fixed: groups.fixed.filter(match),
  };
}

const CASES = [
  { label: "대만 3일", country: "tw", days: 3 },
  { label: "대만 4일", country: "tw", days: 4 },
  { label: "홍콩 3일", country: "hk", days: 3 },
  { label: "홍콩 4일", country: "hk", days: 4 },
];

function count30d(groups: PlanGroups): number {
  let n = 0;
  for (const tab of ["unlimited", "daily", "fixed"] as const) {
    for (const p of groups[tab]) {
      const d = catalogDayOf(p);
      if (d != null && d >= 28) n++;
    }
  }
  return n;
}

async function main() {
  const base = process.env.SIM_BASE_URL ?? "http://localhost:3000";
  for (const c of CASES) {
    const q = new URLSearchParams({ country: c.country, days: String(c.days) });
    const res = await fetch(`${base}/api/bongsim/products/plans?${q}`);
    if (!res.ok) {
      console.log(`\n=== ${c.label} === HTTP ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { groups?: PlanGroups; matched_days?: number };
    const raw: PlanGroups = {
      unlimited: json.groups?.unlimited ?? [],
      daily: json.groups?.daily ?? [],
      fixed: json.groups?.fixed ?? [],
    };
    const windowed = filterPlanGroupsByTripDaysWindow(raw, c.days);
    console.log(`\n=== ${c.label} (trip=${c.days}, matched=${json.matched_days ?? "—"}) ===`);
    console.log(
      `  raw: u=${raw.unlimited.length} d=${raw.daily.length} f=${raw.fixed.length} | after±2: u=${windowed.unlimited.length} d=${windowed.daily.length} f=${windowed.fixed.length}`,
    );
    console.log(`  30일+ SKU after±2: ${count30d(windowed)} (expect 0)`);
    for (const auth of ["not_required", "required"] as const) {
      const filtered = filterAuth(windowed, auth);
      const sorted = sortPlanGroupsForDisplay(filtered, c.days);
      console.log(
        `  [${auth === "not_required" ? "X" : "O"}] unlimited=${sorted.unlimited.length} daily=${sorted.daily.length} fixed=${sorted.fixed.length}`,
      );
      for (const tab of ["unlimited", "daily", "fixed"] as const) {
        const list = sorted[tab];
        if (tab === "fixed" && list.length) {
          const labels = list.map(
            (p) => `${p.allowance_label}/${extractDaysFromDaysRaw(p.days_raw)}d`,
          );
          console.log(`    fixed order: ${labels.join(" → ")}`);
        } else {
          const days = list.map((p) => extractDaysFromDaysRaw(p.days_raw)).filter(Boolean);
          if (days.length) console.log(`    ${tab} days: ${days.join(",")}`);
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
