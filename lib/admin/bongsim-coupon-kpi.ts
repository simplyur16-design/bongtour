import type { Pool } from "pg";

export type CouponKpiTopTemplate = {
  template_label: string;
  issued: number;
  used: number;
  ratio: number;
};

export type CouponKpiPayload = {
  activeUserCoupons: number;
  thisMonthIssued: number;
  thisMonthUsed: number;
  thisMonthExpired: number;
  top5Templates: CouponKpiTopTemplate[];
};

export async function fetchCouponKpi(pool: Pool): Promise<CouponKpiPayload> {
  const bounds = await pool.query<{ m_start: Date; m_end: Date }>(
    `SELECT
       (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul') AS m_start,
       ((date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') + interval '1 month') AT TIME ZONE 'Asia/Seoul') AS m_end`,
  );
  const b = bounds.rows[0];
  if (!b) {
    return { activeUserCoupons: 0, thisMonthIssued: 0, thisMonthUsed: 0, thisMonthExpired: 0, top5Templates: [] };
  }
  const { m_start, m_end } = b;

  const [activeR, issuedR, usedR, expiredR, topR] = await Promise.all([
    pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM bongsim_user_coupon WHERE status = 'active'`),
    pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM bongsim_user_coupon WHERE issued_at >= $1 AND issued_at < $2`,
      [m_start, m_end],
    ),
    pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM bongsim_user_coupon WHERE used_at IS NOT NULL AND used_at >= $1 AND used_at < $2`,
      [m_start, m_end],
    ),
    pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM bongsim_user_coupon WHERE status = 'expired' AND updated_at >= $1 AND updated_at < $2`,
      [m_start, m_end],
    ),
    pool.query<{ template_label: string; issued: string; used: string }>(
      `SELECT
         COALESCE(c.template_label, c.description, c.code) AS template_label,
         COUNT(*)::text AS issued,
         SUM(CASE WHEN uc.status = 'used' THEN 1 ELSE 0 END)::text AS used
       FROM bongsim_user_coupon uc
       JOIN bongsim_coupon c ON c.coupon_id = uc.source_coupon_id
      WHERE c.coupon_kind = 'issuance_template'
      GROUP BY c.coupon_id, c.template_label, c.description, c.code
     HAVING COUNT(*) > 0
      ORDER BY (SUM(CASE WHEN uc.status = 'used' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*)::numeric, 0)) DESC NULLS LAST
      LIMIT 5`,
    ),
  ]);

  const num = (x: string | undefined) => Number.parseInt(x ?? "0", 10) || 0;

  const top5Templates: CouponKpiTopTemplate[] = topR.rows.map((row) => {
    const issued = num(row.issued);
    const used = num(row.used);
    const ratio = issued > 0 ? Math.round((used / issued) * 10000) / 100 : 0;
    return { template_label: row.template_label || "—", issued, used, ratio };
  });

  return {
    activeUserCoupons: num(activeR.rows[0]?.c),
    thisMonthIssued: num(issuedR.rows[0]?.c),
    thisMonthUsed: num(usedR.rows[0]?.c),
    thisMonthExpired: num(expiredR.rows[0]?.c),
    top5Templates,
  };
}
