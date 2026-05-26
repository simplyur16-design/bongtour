import type { Pool } from "pg";

type UsageStatsDbRow = {
  month_key: string;
  year_key: string;
  kind_label: string;
  usage_source: string;
  amount_krw: string;
};

export type CouponUsageStatsMonthRow = {
  month: string;
  year: string;
  byKind: Record<string, number>;
  monthTotal: number;
};

export type CouponUsageStatsYearRow = {
  year: string;
  byKind: Record<string, number>;
  yearTotal: number;
};

export type CouponUsageStatsPayload = {
  kinds: string[];
  monthly: CouponUsageStatsMonthRow[];
  yearly: CouponUsageStatsYearRow[];
  grandTotal: number;
};

const USAGE_STATS_SQL = `
WITH usage_lines AS (
  SELECT
    uc.used_at,
    COALESCE(c.template_label, c.description, c.code) AS kind_label,
    COALESCE(uc.used_amount_krw, 0)::bigint AS amount_krw,
    'user_coupon'::text AS usage_source
  FROM bongsim_user_coupon uc
  JOIN bongsim_coupon c ON c.coupon_id = uc.source_coupon_id
  WHERE uc.status = 'used'
    AND uc.used_at IS NOT NULL

  UNION ALL

  SELECT
    u.used_at,
    COALESCE(c.template_label, c.description, c.code) AS kind_label,
    COALESCE(u.discount_amount_krw, 0)::bigint AS amount_krw,
    'coupon_usage'::text AS usage_source
  FROM bongsim_coupon_usage u
  JOIN bongsim_coupon c ON c.coupon_id = u.coupon_id
  WHERE u.used_at IS NOT NULL
),
tagged AS (
  SELECT
    to_char(ul.used_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') AS month_key,
    to_char(ul.used_at AT TIME ZONE 'Asia/Seoul', 'YYYY') AS year_key,
    COALESCE(NULLIF(ul.kind_label, ''), '—') AS kind_label,
    ul.amount_krw,
    ul.usage_source
  FROM usage_lines ul
)
SELECT
  month_key,
  year_key,
  kind_label,
  usage_source,
  SUM(amount_krw)::text AS amount_krw
FROM tagged
GROUP BY month_key, year_key, kind_label, usage_source
ORDER BY month_key DESC, kind_label ASC, usage_source ASC
`;

function parseAmount(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function sortKindLabels(labels: Iterable<string>): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b, "ko"));
}

export async function fetchCouponUsageStats(pool: Pool): Promise<CouponUsageStatsPayload> {
  const r = await pool.query<UsageStatsDbRow>(USAGE_STATS_SQL);
  const rows = r.rows;

  const kindSet = new Set<string>();
  const monthlyMap = new Map<string, CouponUsageStatsMonthRow>();
  const yearlyMap = new Map<string, CouponUsageStatsYearRow>();
  let grandTotal = 0;

  for (const row of rows) {
    const kind = row.kind_label || "—";
    const amount = parseAmount(row.amount_krw);
    if (amount <= 0) continue;

    kindSet.add(kind);
    grandTotal += amount;

    let monthRow = monthlyMap.get(row.month_key);
    if (!monthRow) {
      monthRow = { month: row.month_key, year: row.year_key, byKind: {}, monthTotal: 0 };
      monthlyMap.set(row.month_key, monthRow);
    }
    monthRow.byKind[kind] = (monthRow.byKind[kind] ?? 0) + amount;
    monthRow.monthTotal += amount;

    let yearRow = yearlyMap.get(row.year_key);
    if (!yearRow) {
      yearRow = { year: row.year_key, byKind: {}, yearTotal: 0 };
      yearlyMap.set(row.year_key, yearRow);
    }
    yearRow.byKind[kind] = (yearRow.byKind[kind] ?? 0) + amount;
    yearRow.yearTotal += amount;
  }

  const kinds = sortKindLabels(kindSet);
  const monthly = [...monthlyMap.values()].sort((a, b) => b.month.localeCompare(a.month));
  const yearly = [...yearlyMap.values()].sort((a, b) => b.year.localeCompare(a.year));

  return { kinds, monthly, yearly, grandTotal };
}
