import type { PoolClient } from "pg";
import type { BongsimCouponDbRow } from "@/lib/bongsim/data/bongsim-coupon";

export { isReservedTemplateCode } from "@/lib/coupon/reserved-template-code";

export type IssuanceSlot = "welcome" | "review" | "admin_manual";

export type IssuanceTemplateRow = BongsimCouponDbRow & {
  template_validity_days: number | null;
};

/** admin_manual 은 런타임 템플릿 코드를 `getTemplateCodeForSlot` 로 전달 */
export const SLOT_TO_TEMPLATE_CODE: Omit<Record<IssuanceSlot, string>, "admin_manual"> & {
  admin_manual: "__RUNTIME__";
} = {
  welcome: "__TPL_WELCOME_BONUS",
  review: "__TPL_REVIEW_REWARD",
  admin_manual: "__RUNTIME__",
};

export function getTemplateCodeForSlot(slot: IssuanceSlot, adminTemplateCode?: string): string {
  if (slot === "admin_manual") {
    const c = adminTemplateCode?.trim();
    if (!c) throw new Error("admin_manual_requires_sourceCouponIdOverride");
    return c;
  }
  return SLOT_TO_TEMPLATE_CODE[slot];
}

export async function getTemplateBySlot(
  client: Pick<PoolClient, "query">,
  slot: IssuanceSlot,
  adminTemplateCode?: string,
): Promise<IssuanceTemplateRow | null> {
  const code = getTemplateCodeForSlot(slot, adminTemplateCode);
  const r = await client.query<IssuanceTemplateRow>(
    `SELECT coupon_id, code, description, discount_type, discount_value::text AS discount_value,
            max_discount_krw::text AS max_discount_krw, min_order_krw::text AS min_order_krw,
            usage_limit, used_count, valid_from, valid_until, is_active,
            template_validity_days
     FROM bongsim_coupon
     WHERE coupon_kind = 'issuance_template' AND code = $1
     LIMIT 1`,
    [code],
  );
  return r.rows[0] ?? null;
}

export function computeExpiresAt(template: IssuanceTemplateRow, now: Date): Date | null {
  const raw = template.template_validity_days;
  const days = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  if (days == null) return null;
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
