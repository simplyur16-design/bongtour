import { getPgPool } from "@/lib/bongsim/db/pool";

export type CatalogProductListRow = {
  option_api_id: string;
  plan_name: string;
  option_label: string;
  network_family: string;
  plan_type: string | null;
  allowance_label: string;
  days_raw: string;
  price_block: unknown;
};

export type ListCatalogProductsParams = {
  network_family?: string | null;
  plan_type?: string | null;
  q?: string | null;
};

export type ListCatalogProductsResult =
  | { ok: true; rows: CatalogProductListRow[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

/**
 * Storefront catalog read. Sort: local first, then plan/option labels; stable for cards.
 */
export async function listCatalogProducts(params: ListCatalogProductsParams): Promise<ListCatalogProductsResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const nf = params.network_family?.trim() || null;
  const pt = params.plan_type?.trim() || null;
  const q = params.q?.trim() || null;
  const qpat = q ? `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` : null;

  try {
    const r = await pool.query<CatalogProductListRow>(
      `SELECT
         option_api_id,
         plan_name,
         option_label,
         network_family,
         plan_type,
         allowance_label,
         days_raw,
         price_block
       FROM bongsim_product_option
       WHERE ($1::text IS NULL OR network_family = $1)
         AND ($2::text IS NULL OR plan_type IS NOT DISTINCT FROM $2)
         AND (
           $3::text IS NULL
           OR plan_name ILIKE $3 ESCAPE '\\'
           OR option_label ILIKE $3 ESCAPE '\\'
           OR option_api_id ILIKE $3 ESCAPE '\\'
         )
       ORDER BY
         CASE network_family WHEN 'local' THEN 0 ELSE 1 END,
         plan_name ASC,
         option_label ASC,
         option_api_id ASC`,
      [nf, pt, qpat],
    );
    return { ok: true, rows: r.rows };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
