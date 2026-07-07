import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import {
  catalogBucketWhereSql,
  type CatalogBucketKey,
  CATALOG_BUCKET_ORDER,
} from "@/lib/bongsim/catalog/catalog-buckets";
import { getKycLabelDistribution, type KycLabelDistribution } from "@/lib/bongsim/esim/kyc-required";
import { getPgPool } from "@/lib/bongsim/db/pool";

export type CatalogProductListRow = {
  option_api_id: string;
  plan_name: string;
  option_label: string;
  network_family: string;
  plan_type: string | null;
  allowance_label: string;
  days_raw: string;
  qos_raw: string | null;
  price_block: unknown;
  flags: Record<string, unknown>;
};

export type ListCatalogProductsParams = {
  network_family?: string | null;
  plan_type?: string | null;
  q?: string | null;
};

export type ListCatalogProductsPaginatedParams = ListCatalogProductsParams & {
  bucket?: CatalogBucketKey | null;
  limit?: number;
  offset?: number;
};

export type ListCatalogProductsResult =
  | { ok: true; rows: CatalogProductListRow[] }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

export type ListCatalogProductsPaginatedResult =
  | { ok: true; rows: CatalogProductListRow[]; total: number }
  | { ok: false; reason: "db_unconfigured" | "db_error" };

export type CatalogBucketCounts = Record<CatalogBucketKey, number>;

export type CatalogKycByPlanName = Record<string, KycLabelDistribution>;

function searchPattern(q: string | null | undefined): string | null {
  const trimmed = q?.trim() || null;
  if (!trimmed) return null;
  return `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

function baseFilterSql(): string {
  return `${BONGSIM_CATALOG_ACTIVE_WHERE}
         AND ($1::text IS NULL OR network_family = $1)
         AND ($2::text IS NULL OR plan_type IS NOT DISTINCT FROM $2)
         AND (
           $3::text IS NULL
           OR plan_name ILIKE $3 ESCAPE '\\'
           OR option_label ILIKE $3 ESCAPE '\\'
           OR option_api_id ILIKE $3 ESCAPE '\\'
         )`;
}

const LIST_SELECT = `SELECT
         option_api_id,
         plan_name,
         option_label,
         network_family,
         plan_type,
         allowance_label,
         days_raw,
         qos_raw,
         price_block,
         flags`;

/**
 * Storefront catalog read. Sort: local first, then plan/option labels; stable for cards.
 */
export async function listCatalogProducts(params: ListCatalogProductsParams): Promise<ListCatalogProductsResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const nf = params.network_family?.trim() || null;
  const pt = params.plan_type?.trim() || null;
  const qpat = searchPattern(params.q);

  try {
    const r = await pool.query<CatalogProductListRow>(
      `${LIST_SELECT}
       FROM bongsim_product_option
       WHERE ${baseFilterSql()}
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

/** Paginated storefront catalog — bucket filter optional. */
export async function listCatalogProductsPaginated(
  params: ListCatalogProductsPaginatedParams,
): Promise<ListCatalogProductsPaginatedResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const nf = params.network_family?.trim() || null;
  const pt = params.plan_type?.trim() || null;
  const qpat = searchPattern(params.q);
  const bucket = params.bucket ?? null;
  const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 24)));
  const offset = Math.max(0, Math.trunc(params.offset ?? 0));
  const bucketSql = bucket ? `AND (${catalogBucketWhereSql(bucket)})` : "";

  try {
    const countR = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM bongsim_product_option
       WHERE ${baseFilterSql()}
         ${bucketSql}`,
      [nf, pt, qpat],
    );
    const total = Number.parseInt(countR.rows[0]?.c ?? "0", 10);

    const r = await pool.query<CatalogProductListRow>(
      `${LIST_SELECT}
       FROM bongsim_product_option
       WHERE ${baseFilterSql()}
         ${bucketSql}
       ORDER BY
         plan_name ASC,
         option_label ASC,
         option_api_id ASC
       LIMIT $4 OFFSET $5`,
      [nf, pt, qpat, limit, offset],
    );
    return { ok: true, rows: r.rows, total };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}

/** Per-bucket totals for catalog section headers (lightweight). */
export async function listCatalogBucketCounts(
  params: ListCatalogProductsParams = {},
): Promise<{ ok: true; counts: CatalogBucketCounts } | { ok: false; reason: "db_unconfigured" | "db_error" }> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const nf = params.network_family?.trim() || null;
  const pt = params.plan_type?.trim() || null;
  const qpat = searchPattern(params.q);

  try {
    const counts = Object.fromEntries(CATALOG_BUCKET_ORDER.map((k) => [k, 0])) as CatalogBucketCounts;
    await Promise.all(
      CATALOG_BUCKET_ORDER.map(async (bucket) => {
        const r = await pool.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c
           FROM bongsim_product_option
           WHERE ${baseFilterSql()}
             AND (${catalogBucketWhereSql(bucket)})`,
          [nf, pt, qpat],
        );
        counts[bucket] = Number.parseInt(r.rows[0]?.c ?? "0", 10);
      }),
    );
    return { ok: true, counts };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}

/** plan_name → KYC badge distribution (flags only — small payload). */
export async function listCatalogKycByPlanName(): Promise<
  { ok: true; kycByPlanName: CatalogKycByPlanName } | { ok: false; reason: "db_unconfigured" | "db_error" }
> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  try {
    const r = await pool.query<{ plan_name: string; flags: Record<string, unknown> }>(
      `SELECT plan_name, flags
       FROM bongsim_product_option
       WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}`,
    );
    const byPlan = new Map<string, { flags?: Record<string, unknown> | null }[]>();
    for (const row of r.rows) {
      const siblings = byPlan.get(row.plan_name) ?? [];
      siblings.push({ flags: row.flags });
      byPlan.set(row.plan_name, siblings);
    }
    const kycByPlanName: CatalogKycByPlanName = {};
    for (const [planName, siblings] of byPlan) {
      kycByPlanName[planName] = getKycLabelDistribution(siblings);
    }
    return { ok: true, kycByPlanName };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
