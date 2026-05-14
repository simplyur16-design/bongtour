/**
 * PHASE 4.5 dry-run: 운영 DB SELECT만으로 PHASE 1~4 산출물(파싱·선정·라벨) 검증.
 *
 * 실행:
 *   npx tsx scripts/dry-run-recommendation-labels.ts | tee dry-run-output.txt
 *
 * 운영 영향 0 — SELECT 전용. ALTER/INSERT/UPDATE/DELETE 없음.
 */
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

import { closePgPool, getPgPool, probePgPoolTlsOrFallback } from "@/lib/bongsim/db/pool";
import { planNameKrFromCountryCode } from "@/lib/bongsim/country-options";
import {
  MULTI_COUNTRY_PLAN_COVERAGE,
  doesPlanCoverAllSelected,
  getPlanCoveredCountries,
} from "@/lib/bongsim/plan-coverage-map";
import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { selectSingleCountryRecommendation } from "@/lib/bongsim/recommend/select-single-country-recommendation";
import { selectMultiCountryRecommendation } from "@/lib/bongsim/recommend/select-multi-country-recommendation";
import {
  getRecommendationDisplay,
  type RecommendationDisplay,
} from "@/lib/bongsim/recommend/get-recommendation-label";

type RawRow = BongsimProductOptionV1 & { is_active?: boolean | null };

const POPULAR_COUNTRY_CODES = ["jp", "vn", "th", "us", "fr", "it", "gb", "ph"];

type ComboSpec = {
  codes: string[];
  intent: string;
  /** scenario B 자동 판정용 */
  expect:
    | { kind: "exact_covered"; n: number }
    | { kind: "min_among"; allowed: number[] }
    | { kind: "no_eligible" };
};

const MULTI_COMBOS: ComboSpec[] = [
  { codes: ["hk", "mo"], intent: '키 "홍콩/마카오" 정확 매칭 — 글로벌151 오버스펙 회피', expect: { kind: "exact_covered", n: 2 } },
  { codes: ["my", "sg"], intent: "동남아 패키지가 두 국가 다 커버하는지", expect: { kind: "exact_covered", n: 3 } },
  { codes: ["vn", "kh"], intent: "앙코르왓 루트 — 동남아 N개국 매칭", expect: { kind: "exact_covered", n: 8 } },
  { codes: ["fr", "it", "ch"], intent: "유럽 인접 3국 — 유럽33/36/42 중 가장 작은 것 우선", expect: { kind: "min_among", allowed: [33, 36] } },
  { codes: ["au", "nz"], intent: '키 "호주/뉴질랜드" 정확 매칭', expect: { kind: "exact_covered", n: 2 } },
  { codes: ["us", "ca"], intent: '키 "미국/캐나다" 매칭 — 멕시코 포함 3개국 키 회피', expect: { kind: "exact_covered", n: 2 } },
  { codes: ["kr", "sa", "eg"], intent: "매칭 0건 예상 — noEligible: true 검증", expect: { kind: "no_eligible" } },
];

const SELECT_ALL_ACTIVE = `
  SELECT
    option_api_id, vendor_code, sim_kind, excel_update_type, excel_sheet,
    excel_sheet_language, plan_line_excel, network_family, plan_type,
    plan_name, days_raw, allowance_label, option_label,
    carrier_raw, data_class_raw, network_raw, internet_raw, qos_raw,
    validity_raw, apn_raw, install_benchmark_raw, activation_policy_raw,
    mcc_raw, mnc_raw, flags, price_block, raw_row,
    classification_conflict, classification_notes, created_at, updated_at,
    is_active
  FROM bongsim_product_option
  WHERE is_active IS DISTINCT FROM false
  ORDER BY plan_name, days_raw, COALESCE(
    (price_block->'after'->>'consumer_krw')::numeric,
    (price_block->'before'->>'consumer_krw')::numeric
  ) ASC NULLS LAST
`;

function header(title: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function fmtDisplay(d: RecommendationDisplay): string {
  return `[${d.kind}] ${d.label} / ${d.subCopy}`;
}

function trunc(s: string | null | undefined, n = 60): string {
  const v = String(s ?? "").replace(/\s+/g, " ").trim();
  if (v.length <= n) return v;
  return v.slice(0, n - 1) + "…";
}

function isSingleCountryForCode(row: RawRow, code: string): boolean {
  const covered = getPlanCoveredCountries(row.plan_name);
  if (covered.length === 1 && covered[0] === code) return true;
  const nameKr = planNameKrFromCountryCode(code);
  return Boolean(nameKr && row.plan_name.trim() === nameKr);
}

async function fetchAllActiveOptions(): Promise<RawRow[]> {
  const pool = getPgPool();
  if (!pool) {
    console.error("[fatal] DATABASE_URL 미설정 또는 풀 생성 실패");
    process.exit(1);
  }
  const r = await pool.query(SELECT_ALL_ACTIVE);
  return r.rows as RawRow[];
}

function scenarioA(all: RawRow[]): void {
  header("scenario A — 단일국가 라벨 분포");
  for (const code of POPULAR_COUNTRY_CODES) {
    const candidates = all.filter((row) => isSingleCountryForCode(row, code));
    const sel = selectSingleCountryRecommendation(candidates);

    const nameKr = planNameKrFromCountryCode(code) ?? code.toUpperCase();
    console.log(`\n[${code}] ${nameKr} — candidates ${candidates.length}건, totalCandidates ${sel.totalCandidates}`);

    const slots: Array<["recommended" | "gentle1" | "gentle2", typeof sel.recommended]> = [
      ["recommended", sel.recommended],
      ["gentle1", sel.gentle1],
      ["gentle2", sel.gentle2],
    ];
    for (const [slot, opt] of slots) {
      if (!opt) {
        console.log(`  ${slot.padEnd(11)} [empty]`);
        continue;
      }
      const disp = getRecommendationDisplay(opt, { isMultiCountry: false });
      console.log(
        `  ${slot.padEnd(11)} ${opt.option_api_id} | ${trunc(opt.plan_name, 24)} | ` +
          `용량=${trunc(opt.allowance_label, 18)} | NW=${trunc(opt.network_raw, 14)} | ` +
          `IF=${trunc(opt.internet_raw, 14)} | QOS=${trunc(opt.qos_raw, 14)}`,
      );
      console.log(`               → ${fmtDisplay(disp)}`);
    }
  }
}

type ComboResult = ComboSpec & {
  recommendedId: string | null;
  planName: string | null;
  coveredCount: number;
  totalEligibleCount: number;
  noEligible: boolean;
  display: RecommendationDisplay | null;
  passLabel: "PASS" | "FAIL";
  passDetail: string;
};

function scenarioB(all: RawRow[]): ComboResult[] {
  header("scenario B — 다국가 라벨 분포 (한국인 여행 패턴)");
  const out: ComboResult[] = [];
  for (const spec of MULTI_COMBOS) {
    // by-country/route.ts의 multi 필터 패턴 모방
    const candidatesNarrow = all.filter((p) => {
      const covered = getPlanCoveredCountries(p.plan_name);
      return covered.length >= 2 && doesPlanCoverAllSelected(p.plan_name, spec.codes);
    });
    const result = selectMultiCountryRecommendation(spec.codes, candidatesNarrow);

    const coveredCount = result.coveredCountryCodes.length;
    const display = result.recommended
      ? getRecommendationDisplay(result.recommended, {
          isMultiCountry: true,
          coveredCountryCount: coveredCount,
        })
      : null;

    let passLabel: "PASS" | "FAIL" = "PASS";
    let passDetail = "";
    switch (spec.expect.kind) {
      case "exact_covered": {
        const want = spec.expect.n;
        if (!result.recommended) {
          passLabel = "FAIL";
          passDetail = `recommended null (eligible ${result.totalEligibleCount})`;
        } else if (coveredCount !== want) {
          passLabel = "FAIL";
          passDetail = `covered=${coveredCount} (want ${want})`;
        } else {
          passDetail = `covered=${coveredCount} ok`;
        }
        break;
      }
      case "min_among": {
        if (!result.recommended) {
          passLabel = "FAIL";
          passDetail = `recommended null`;
        } else if (!spec.expect.allowed.includes(coveredCount)) {
          passLabel = "FAIL";
          passDetail = `covered=${coveredCount} not in {${spec.expect.allowed.join(",")}}`;
        } else {
          passDetail = `covered=${coveredCount} in {${spec.expect.allowed.join(",")}}`;
        }
        break;
      }
      case "no_eligible": {
        if (result.noEligible && result.recommended == null) {
          passDetail = "noEligible=true";
        } else {
          passLabel = "FAIL";
          passDetail = `noEligible=${result.noEligible}, recommended=${result.recommended?.option_api_id ?? "null"}`;
        }
        break;
      }
    }

    out.push({
      ...spec,
      recommendedId: result.recommended?.option_api_id ?? null,
      planName: result.recommended?.plan_name ?? null,
      coveredCount,
      totalEligibleCount: result.totalEligibleCount,
      noEligible: result.noEligible,
      display,
      passLabel,
      passDetail,
    });
  }

  console.log("");
  console.log(
    "| 조합 | 의도 | recommendedId | plan_name | covered | eligible | noEligible | label / subCopy | 판정 |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of out) {
    const label = r.display ? `${r.display.label} / ${r.display.subCopy}` : "-";
    console.log(
      `| ${r.codes.join("+")} | ${trunc(r.intent, 48)} | ${r.recommendedId ?? "-"} | ${trunc(r.planName ?? "-", 24)} | ${r.coveredCount} | ${r.totalEligibleCount} | ${r.noEligible} | ${trunc(label, 48)} | ${r.passLabel} (${r.passDetail}) |`,
    );
  }
  return out;
}

type SceneCResult = {
  total: number;
  counts: Record<string, number>;
  noneRatio: number;
  verdict: "PASS" | "REVIEW" | "BLOCK";
  noneTop: RawRow[];
};

function scenarioC(all: RawRow[]): SceneCResult {
  header("scenario C — 'none' 폴백 빈도 집계");
  const counts: Record<string, number> = {
    true_unlimited: 0,
    unlimited: 0,
    high_daily: 0,
    none: 0,
  };
  const noneRows: RawRow[] = [];

  for (const row of all) {
    const d = getRecommendationDisplay(row, { isMultiCountry: false });
    counts[d.kind] = (counts[d.kind] ?? 0) + 1;
    if (d.kind === "none") noneRows.push(row);
  }

  const total = all.length;
  const noneRatio = total === 0 ? 0 : counts.none! / total;
  let verdict: "PASS" | "REVIEW" | "BLOCK" = "PASS";
  if (noneRatio >= 0.05) verdict = "BLOCK";
  else if (noneRatio >= 0.01) verdict = "REVIEW";

  console.log("");
  console.log(`| kind            | count | 비율(%) |`);
  console.log(`| --------------- | ----- | ------- |`);
  for (const k of ["true_unlimited", "unlimited", "high_daily", "none"] as const) {
    const c = counts[k] ?? 0;
    const pct = total === 0 ? 0 : (c / total) * 100;
    console.log(`| ${k.padEnd(15)} | ${String(c).padStart(5)} | ${pct.toFixed(2).padStart(7)} |`);
  }
  console.log(`총 활성 옵션: ${total}건`);
  console.log(`'none' 비율: ${(noneRatio * 100).toFixed(2)}%  →  ${verdict}`);

  console.log("\n[kind='none' 상위 10건]");
  const top = noneRows.slice(0, 10);
  for (const row of top) {
    console.log(
      `  ${row.option_api_id} | plan=${trunc(row.plan_name, 24)} | 용량=${trunc(row.allowance_label, 18)} | ` +
        `NW=${trunc(row.network_raw, 12)} | IF=${trunc(row.internet_raw, 12)} | QOS=${trunc(row.qos_raw, 12)}`,
    );
  }

  return { total, counts, noneRatio, verdict, noneTop: top };
}

function scenarioD(): void {
  header("scenario D — 다국가 covered count sanity");
  const keys = Object.keys(MULTI_COUNTRY_PLAN_COVERAGE);
  type Mismatch = { key: string; nameN: number | null; actual: number; diff: string };
  const mismatches: Mismatch[] = [];

  for (const key of keys) {
    const covered = getPlanCoveredCountries(key);
    const actual = covered.length;
    const m = key.match(/(\d+)/);
    const nameN = m ? parseInt(m[1]!, 10) : null;
    if (actual === 0) {
      mismatches.push({ key, nameN, actual, diff: "empty" });
      continue;
    }
    if (nameN != null && nameN !== actual) {
      mismatches.push({ key, nameN, actual, diff: String(actual - nameN) });
    }
  }

  if (mismatches.length === 0) {
    console.log("\n불일치 0건");
    return;
  }
  console.log("");
  console.log("| key | 명칭상 N | 실제 length | 차이 |");
  console.log("| --- | --- | --- | --- |");
  for (const r of mismatches) {
    console.log(`| ${r.key} | ${r.nameN ?? "-"} | ${r.actual} | ${r.diff} |`);
  }
}

async function main() {
  header(`bongsim dry-run @ ${new Date().toISOString()} (Asia/Seoul ≈ ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })})`);
  const probe = await probePgPoolTlsOrFallback();
  console.log(`pg pool probe: ok=${probe.ok}, sslStrict=${probe.sslStrict}`);
  if (!probe.ok) {
    console.error("[fatal] pg pool probe 실패 — DATABASE_URL 또는 TLS 확인 필요");
    process.exit(1);
  }
  const all = await fetchAllActiveOptions();
  console.log(`fetched ${all.length} active options`);

  scenarioA(all);
  const comboResults = scenarioB(all);
  const cRes = scenarioC(all);
  scenarioD();

  header("종합 판정");
  const failedB = comboResults.filter((r) => r.passLabel === "FAIL");
  console.log(`scenario B FAIL 건수: ${failedB.length} / ${comboResults.length}`);
  for (const f of failedB) console.log(`  - ${f.codes.join("+")}: ${f.passDetail}`);
  console.log(`scenario C 판정: ${cRes.verdict}  (none ${(cRes.noneRatio * 100).toFixed(2)}%)`);
  const allGreen = failedB.length === 0 && cRes.verdict === "PASS";
  console.log(`PHASE 5a 진입 가능: ${allGreen ? "YES (모두 PASS)" : "NO (보고 후 결정)"}`);
}

main()
  .then(async () => {
    await closePgPool();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("[dry-run] failed:", e);
    try {
      await closePgPool();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
