/**
 * 9/1 00:00 KST 전에 20260901 after 가격을 연다.
 * price_block.effective_from 을 이미 지난 시각으로 옮긴다.
 */
import "./load-env-for-scripts";
import { closePgPool, getPgPool } from "@/lib/bongsim/db/pool";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";

const OPENED = "2026-08-31T00:00:00+09:00";

async function main() {
  const apply = process.argv.includes("--apply");
  const pool = getPgPool();
  if (!pool) throw new Error("no pool");

  const before = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM bongsim_product_option WHERE price_block->>'effective_from' = $1`,
    [BONGSIM_PRICE_EFFECTIVE_FROM_20260901],
  );
  console.log(
    JSON.stringify(
      {
        apply,
        from: BONGSIM_PRICE_EFFECTIVE_FROM_20260901,
        to: OPENED,
        rows_with_sept_stamp: before.rows[0].n,
      },
      null,
      2,
    ),
  );
  if (!apply) {
    console.log("dry_run — pass --apply to write");
    await closePgPool();
    return;
  }

  const upd = await pool.query(
    `UPDATE bongsim_product_option
     SET price_block = jsonb_set(price_block, '{effective_from}', to_jsonb($1::text), true)
     WHERE price_block->>'effective_from' = $2`,
    [OPENED, BONGSIM_PRICE_EFFECTIVE_FROM_20260901],
  );
  console.log(JSON.stringify({ updated: upd.rowCount }, null, 2));
  await closePgPool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
