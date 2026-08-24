/**
 * 20260316 공급가 = 2026-08-31 23:59 KST까지 (price_block.before).
 * 20260901 공급가 = 2026-09-01 00:00 KST부터 (price_block.after).
 * after는 덮어쓰지 않고 before만 채운 뒤, 9/1 파일로 after를 맞춘다.
 */
import fs from "node:fs";
import "./load-env-for-scripts";
import { BONGSIM_INGEST_SHEETS } from "@/lib/bongsim/ingest/excel-sheet-config";
import { normalizeExcelRow } from "@/lib/bongsim/ingest/excel-normalize-row";
import {
  parseIngestSheet,
  readWorkbookFromBuffer,
  sheetRowsAsRecords,
} from "@/lib/bongsim/ingest/excel-parse-workbook";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { BONGSIM_PRICE_EFFECTIVE_FROM_20260901 } from "@/lib/bongsim/data/pricing-effective-from";
import type { PriceTriple } from "@/lib/bongsim/data/pricing-effective-from";

const MARCH_PATH = "C:\\Users\\USER\\Desktop\\usimsa\\20260316_공급가(전체).xlsx";
const SEPT_PATH = "C:\\Users\\USER\\Desktop\\usimsa\\20260901_공급가(전체).xlsx";

type PriceMap = Map<string, PriceTriple>;

function loadPriceMap(path: string): PriceMap {
  const buf = fs.readFileSync(path);
  const workbook = readWorkbookFromBuffer(buf);
  const out: PriceMap = new Map();
  for (const cfg of BONGSIM_INGEST_SHEETS) {
    if (!workbook.SheetNames.includes(cfg.sheet_name)) continue;
    const parsed = parseIngestSheet(workbook, cfg);
    if (!parsed) continue;
    for (const rec of sheetRowsAsRecords(parsed)) {
      const opt = normalizeExcelRow(
        {
          workbook_id: "cutover-sides",
          sheet_name: cfg.sheet_name,
          sheet_language: cfg.sheet_language,
          plan_line_excel: cfg.plan_line_excel,
        },
        rec,
      );
      if (!opt.option_api_id || opt.option_api_id.length < 8) continue;
      out.set(opt.option_api_id, { ...opt.price_block.after });
    }
  }
  return out;
}

function tripleSql(t: PriceTriple) {
  return {
    consumer_krw: t.consumer_krw,
    recommended_krw: t.recommended_krw,
    supply_krw: t.supply_krw,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log("cutover", BONGSIM_PRICE_EFFECTIVE_FROM_20260901);
  console.log("march_exists", fs.existsSync(MARCH_PATH), "sept_exists", fs.existsSync(SEPT_PATH));

  const march = loadPriceMap(MARCH_PATH);
  const sept = loadPriceMap(SEPT_PATH);
  let same = 0;
  let different = 0;
  for (const [id, m] of march) {
    const s = sept.get(id);
    if (!s) continue;
    const eq =
      m.supply_krw === s.supply_krw &&
      m.consumer_krw === s.consumer_krw &&
      m.recommended_krw === s.recommended_krw;
    if (eq) same += 1;
    else different += 1;
  }
  const onlyMarch = [...march.keys()].filter((id) => !sept.has(id)).length;
  const onlySept = [...sept.keys()].filter((id) => !march.has(id)).length;
  console.log("parsed", {
    march: march.size,
    sept: sept.size,
    overlap_same: same,
    overlap_different: different,
    only_march: onlyMarch,
    only_sept: onlySept,
  });

  const pool = getPgPool();
  if (!pool) {
    console.log("db_unconfigured");
    process.exit(1);
  }

  if (!apply) {
    console.log("dry_run — pass --apply to write before=20260316 after=20260901");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const marchRows = [...march.entries()].map(([option_api_id, price]) => ({
      option_api_id,
      price: tripleSql(price),
    }));
    const septRows = [...sept.entries()].map(([option_api_id, price]) => ({
      option_api_id,
      price: tripleSql(price),
    }));
    const marchOnlyIds = [...march.keys()].filter((id) => !sept.has(id));

    const beforeRes = await client.query(
      `UPDATE bongsim_product_option AS o
       SET price_block = jsonb_set(
             jsonb_set(COALESCE(o.price_block, '{}'::jsonb), '{before}', v.price),
             '{effective_from}',
             to_jsonb($2::text)
           ),
           updated_at = now()
       FROM jsonb_to_recordset($1::jsonb) AS v(option_api_id text, price jsonb)
       WHERE o.option_api_id = v.option_api_id`,
      [JSON.stringify(marchRows), BONGSIM_PRICE_EFFECTIVE_FROM_20260901],
    );

    const afterRes = await client.query(
      `UPDATE bongsim_product_option AS o
       SET price_block = jsonb_set(
             jsonb_set(COALESCE(o.price_block, '{}'::jsonb), '{after}', v.price),
             '{effective_from}',
             to_jsonb($2::text)
           ),
           updated_at = now()
       FROM jsonb_to_recordset($1::jsonb) AS v(option_api_id text, price jsonb)
       WHERE o.option_api_id = v.option_api_id`,
      [JSON.stringify(septRows), BONGSIM_PRICE_EFFECTIVE_FROM_20260901],
    );

    const emptyAfter = { consumer_krw: null, recommended_krw: null, supply_krw: null };
    const marchOnlyRes = await client.query(
      `UPDATE bongsim_product_option
       SET price_block = jsonb_set(
             jsonb_set(COALESCE(price_block, '{}'::jsonb), '{after}', $2::jsonb),
             '{effective_from}',
             to_jsonb($3::text)
           ),
           is_active = true,
           updated_at = now()
       WHERE option_api_id = ANY($1::text[])`,
      [marchOnlyIds, JSON.stringify(emptyAfter), BONGSIM_PRICE_EFFECTIVE_FROM_20260901],
    );

    await client.query("COMMIT");
    console.log("applied", {
      before_rows: beforeRes.rowCount ?? 0,
      after_rows: afterRes.rowCount ?? 0,
      march_only_cleared_after: marchOnlyRes.rowCount ?? 0,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const check = await pool.query(
    `
    SELECT
      count(*) FILTER (
        WHERE jsonb_typeof(price_block->'before'->'supply_krw') = 'number'
           OR jsonb_typeof(price_block->'before'->'consumer_krw') = 'number'
      )::int AS has_before,
      count(*) FILTER (
        WHERE price_block->>'effective_from' = $1
      )::int AS from_sept1
    FROM bongsim_product_option
    WHERE is_active
  `,
    [BONGSIM_PRICE_EFFECTIVE_FROM_20260901],
  );
  console.log("active_after_apply", check.rows[0]);
  await pool.end();
}

main().catch((e) => {
  console.error("apply_fail", e instanceof Error ? e.message : "error");
  process.exit(1);
});
