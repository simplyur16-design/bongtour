/**
 * raw_row `요청\\n(발송)` → flags.request_shipment 복구.
 * 9/1 워크북 헤더 줄바꿈이 매핑에서 빠져 플랜 피커가 전부 비었음.
 */
import "./load-env-for-scripts";
import { getPgPool } from "@/lib/bongsim/db/pool";

async function main() {
  const apply = process.argv.includes("--apply");
  const pool = getPgPool();
  if (!pool) {
    console.log("db_unconfigured");
    process.exit(1);
  }

  const preview = await pool.query(`
    SELECT
      count(*) FILTER (
        WHERE nullif(btrim(COALESCE(
          raw_row ->> E'요청\\n(발송)',
          raw_row ->> '요청(발송)',
          raw_row ->> '요청 (발송)'
        )), '') IS NOT NULL
          AND COALESCE(flags->>'request_shipment', '') IN ('', '—', '-')
      )::int AS would_update,
      count(*) FILTER (WHERE upper(COALESCE(flags->>'request_shipment', '')) = 'O')::int AS ship_o_now
    FROM bongsim_product_option
  `);
  console.log("preview", preview.rows[0]);

  if (!apply) {
    console.log("dry_run — pass --apply to update");
    await pool.end();
    return;
  }

  const updated = await pool.query(`
    UPDATE bongsim_product_option AS o
    SET
      flags = jsonb_set(
        COALESCE(o.flags, '{}'::jsonb),
        '{request_shipment}',
        to_jsonb(v.ship),
        true
      ),
      updated_at = now()
    FROM (
      SELECT
        option_api_id,
        btrim(COALESCE(
          raw_row ->> E'요청\\n(발송)',
          raw_row ->> '요청(발송)',
          raw_row ->> '요청 (발송)'
        )) AS ship
      FROM bongsim_product_option
    ) v
    WHERE o.option_api_id = v.option_api_id
      AND v.ship IS NOT NULL
      AND v.ship <> ''
      AND COALESCE(o.flags->>'request_shipment', '') IN ('', '—', '-')
  `);
  console.log("updated", updated.rowCount);

  const after = await pool.query(`
    SELECT
      upper(COALESCE(flags->>'request_shipment', '')) AS ship,
      count(*)::int AS n
    FROM bongsim_product_option
    WHERE is_active
    GROUP BY 1
    ORDER BY n DESC
  `);
  console.log("ship_dist_after", after.rows);
  await pool.end();
}

main().catch((e) => {
  console.error("backfill_fail", e instanceof Error ? e.message : "error");
  process.exit(1);
});
