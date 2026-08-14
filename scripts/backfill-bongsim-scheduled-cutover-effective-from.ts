/**
 * Stamp Sept 1 cutover on early-leaked “신규 상품” / “상품 확장” after-only SKUs.
 * Existing countries keep before-priced rows; new countries hide until 2026-09-01 00:00 KST.
 * REGRESSION-FREEZE[bongsim-price-effective-from]: scheduled country hide backfill — manifest
 *
 * Usage: npx tsx scripts/backfill-bongsim-scheduled-cutover-effective-from.ts [--dry-run]
 */
import { Pool } from "pg";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const raw = process.env.DATABASE_URL?.trim() || process.env.BONGSIM_DATABASE_URL?.trim();
  if (!raw) {
    console.error("DATABASE_URL (or BONGSIM_DATABASE_URL) required");
    process.exit(1);
  }
  const url = raw.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?$/, "");
  const pool = new Pool({ connectionString: url, max: 2, ssl: { rejectUnauthorized: false } });
  const cutover = BONGSIM_PRICE_EFFECTIVE_FROM_20260901;

  const where = `
    is_active = true
    AND sim_kind ILIKE '%esim%'
    AND excel_update_type IN ('신규 상품', '상품 확장')
    AND nullif(btrim(price_block->>'effective_from'), '') IS NULL
    AND (
      price_block->'before'->>'consumer_krw' IS NULL
      OR btrim(coalesce(price_block->'before'->>'consumer_krw', '')) IN ('', 'null')
    )
    AND (
      jsonb_typeof(price_block->'after'->'consumer_krw') = 'number'
      OR (
        jsonb_typeof(price_block->'after'->'consumer_krw') = 'string'
        AND (price_block->'after'->>'consumer_krw') ~ '^[0-9]+([.][0-9]+)?$'
      )
    )
  `;

  const found = await pool.query<{
    option_api_id: string;
    plan_name: string | null;
    excel_update_type: string | null;
  }>(`
    SELECT option_api_id, plan_name, excel_update_type
    FROM bongsim_product_option
    WHERE ${where}
    ORDER BY plan_name, option_api_id
  `);

  const plans = [...new Set(found.rows.map((r) => (r.plan_name ?? "").trim()).filter(Boolean))].sort();
  console.log(`candidates=${found.rowCount} plans=${plans.length} dryRun=${dryRun} cutover=${cutover}`);
  for (const name of plans) console.log(`  plan: ${name}`);

  if (dryRun || found.rowCount === 0) {
    await pool.end();
    return;
  }

  const upd = await pool.query(
    `
    UPDATE bongsim_product_option
    SET price_block = jsonb_set(
          COALESCE(price_block, '{}'::jsonb),
          '{effective_from}',
          to_jsonb($1::text),
          true
        ),
        updated_at = now()
    WHERE option_api_id = ANY($2::text[])
    `,
    [cutover, found.rows.map((r) => r.option_api_id)],
  );
  console.log(`updated=${upd.rowCount}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
