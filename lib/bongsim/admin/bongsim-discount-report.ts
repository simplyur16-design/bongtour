import type { Pool } from "pg";

export type BongsimDiscountReportRow = {
  used_at: Date;
  order_number: string;
  code: string;
  description: string | null;
  original_amount_krw: string;
  discount_amount_krw: string;
  final_amount_krw: string;
  buyer_email: string;
  source: "coupon" | "complimentary_esim";
};

/** REGRESSION-FREEZE[bongsim-discount-report-complimentary]: 쿠폰 사용 + 무상 eSIM 할인 리포트 SSOT — manifest */
export const BONGSIM_DISCOUNT_REPORT_COMPLIMENTARY_CODE = "무상eSIM";

export async function queryBongsimDiscountReportRows(
  pool: Pool,
  start: Date,
  end: Date,
): Promise<BongsimDiscountReportRow[]> {
  const r = await pool.query<BongsimDiscountReportRow>(
    `SELECT u.used_at,
            o.order_number,
            c.code,
            c.description,
            u.original_amount_krw::text AS original_amount_krw,
            u.discount_amount_krw::text AS discount_amount_krw,
            u.final_amount_krw::text AS final_amount_krw,
            o.buyer_email,
            'coupon'::text AS source
       FROM bongsim_coupon_usage u
       JOIN bongsim_order o ON o.order_id = u.order_id
       JOIN bongsim_coupon c ON c.coupon_id = u.coupon_id
      WHERE u.used_at >= $1 AND u.used_at < $2
     UNION ALL
     SELECT o.paid_at AS used_at,
            o.order_number,
            $3::text AS code,
            COALESCE(o.consents->'complimentary_esim'->>'reason_memo', '') AS description,
            o.subtotal_krw::text AS original_amount_krw,
            o.discount_krw::text AS discount_amount_krw,
            o.grand_total_krw::text AS final_amount_krw,
            o.buyer_email,
            'complimentary_esim'::text AS source
       FROM bongsim_order o
      WHERE o.checkout_channel = 'admin_complimentary_esim'
        AND o.paid_at IS NOT NULL
        AND o.status IN ('paid', 'delivered', 'refunded')
        AND o.paid_at >= $1 AND o.paid_at < $2
      ORDER BY used_at ASC`,
    [start.toISOString(), end.toISOString(), BONGSIM_DISCOUNT_REPORT_COMPLIMENTARY_CODE],
  );
  return r.rows;
}

export function summarizeBongsimDiscountReportRows(rows: BongsimDiscountReportRow[]): {
  count: number;
  total_discount_krw: number;
  total_final_krw: number;
} {
  let sumDisc = 0;
  let sumFinal = 0;
  for (const row of rows) {
    sumDisc += Number.parseInt(row.discount_amount_krw, 10) || 0;
    sumFinal += Number.parseInt(row.final_amount_krw, 10) || 0;
  }
  return { count: rows.length, total_discount_krw: sumDisc, total_final_krw: sumFinal };
}
