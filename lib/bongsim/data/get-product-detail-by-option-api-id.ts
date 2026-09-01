import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import {
  classifyBongsimPgError,
  getPgPool,
  healBongsimPgPoolForCatalog,
  shouldSkipCatalogHealBecauseSaturated,
  withBongsimCatalogRetry,
  withBongsimStatementTimeout,
} from "@/lib/bongsim/db/pool";
import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import type { BongsimProductOptionDbRow } from "@/lib/bongsim/data/bongsim-product-option-db-row";
import { mapDbRowToProductOptionV1 } from "@/lib/bongsim/data/map-row-to-product-option-v1";
import { mapProductOptionToDetailV1 } from "@/lib/bongsim/data/map-product-option-to-detail-v1";

// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: homepage detail EMAXCONN ≠ not_found — manifest

export type GetProductDetailResult =
  | { ok: true; detail: BongsimProductDetailV1 }
  | { ok: false; reason: "db_unconfigured" | "not_found" | "db_error" | "connection_timeout" };

async function queryProductDetail(optionApiId: string): Promise<GetProductDetailResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const result = await withBongsimCatalogRetry(() =>
    withBongsimStatementTimeout((client) =>
      client.query<BongsimProductOptionDbRow>(
        `SELECT *
         FROM bongsim_product_option
         WHERE option_api_id = $1
           AND ${BONGSIM_CATALOG_ACTIVE_WHERE}
         LIMIT 1`,
        [optionApiId],
      ),
    ),
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  const opt = mapDbRowToProductOptionV1(row);
  return { ok: true, detail: mapProductOptionToDetailV1(opt) };
}

export async function getProductDetailByOptionApiId(optionApiId: string): Promise<GetProductDetailResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const id = optionApiId.trim();
  if (!id) return { ok: false, reason: "not_found" };

  try {
    return await queryProductDetail(id);
  } catch (e) {
    const kind = classifyBongsimPgError(e);
    if (kind !== "connection_timeout") return { ok: false, reason: "db_error" };
    if (shouldSkipCatalogHealBecauseSaturated(e)) return { ok: false, reason: "connection_timeout" };
    await healBongsimPgPoolForCatalog("bongsim-product-detail");
    try {
      return await queryProductDetail(id);
    } catch (e2) {
      return {
        ok: false,
        reason: classifyBongsimPgError(e2) === "connection_timeout" ? "connection_timeout" : "db_error",
      };
    }
  }
}
