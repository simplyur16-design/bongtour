import { getPgPool } from "@/lib/bongsim/db/pool";
import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import type { BongsimProductOptionDbRow } from "@/lib/bongsim/data/bongsim-product-option-db-row";
import { mapDbRowToProductOptionV1 } from "@/lib/bongsim/data/map-row-to-product-option-v1";

export type GetProductOptionV1Result =
  | { ok: true; option: BongsimProductOptionV1 }
  | { ok: false; reason: "db_unconfigured" | "not_found" | "db_error" };

export async function getProductOptionV1ByOptionApiId(optionApiId: string): Promise<GetProductOptionV1Result> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const id = optionApiId.trim();
  if (!id) return { ok: false, reason: "not_found" };

  try {
    const res = await pool.query<BongsimProductOptionDbRow>(
      `SELECT * FROM bongsim_product_option WHERE option_api_id = $1 LIMIT 1`,
      [id],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, reason: "not_found" };
    return { ok: true, option: mapDbRowToProductOptionV1(row) };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
