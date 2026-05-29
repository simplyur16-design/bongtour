import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool } from "@/lib/bongsim/db/pool";
import type { KycProductFlags } from "@/lib/bongsim/esim/kyc-required";

export async function listKycFlagProductsForPlanName(planName: string): Promise<KycProductFlags[]> {
  const pool = getPgPool();
  if (!pool) return [];

  const name = planName.trim();
  if (!name) return [];

  try {
    const res = await pool.query<{ flags: Record<string, unknown> }>(
      `SELECT flags
       FROM bongsim_product_option
       WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
         AND plan_name = $1`,
      [name],
    );
    return res.rows.map((row) => ({ flags: row.flags }));
  } catch {
    return [];
  }
}
