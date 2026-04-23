import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { BONGSIM_INGEST_SHEETS } from "@/lib/bongsim/ingest/excel-sheet-config";
import { normalizeExcelRow } from "@/lib/bongsim/ingest/excel-normalize-row";
import { hashExcelRowStable } from "@/lib/bongsim/ingest/excel-hash-row";
import { parseIngestSheet, readWorkbookFromBuffer, sheetRowsAsRecords } from "@/lib/bongsim/ingest/excel-parse-workbook";
import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { getPgPool } from "@/lib/bongsim/db/pool";

export type RunExcelImportResult =
  | {
      ok: true;
      workbook_id: string;
      rows_upserted: number;
      rows_skipped: number;
      price_events_written: number;
      sheet_stats: Record<string, { rows: number; upserted: number; skipped: number }>;
    }
  | {
      ok: false;
      error: "db_unconfigured" | "parse_failed" | "db_error" | "duplicate_import";
      workbook_id?: string;
      message?: string;
    };

function workbookIdFromBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

async function upsertProductOption(client: PoolClient, opt: BongsimProductOptionV1): Promise<void> {
  await client.query(
    `INSERT INTO bongsim_product_option (
      option_api_id, vendor_code, sim_kind, excel_update_type, excel_sheet, excel_sheet_language,
      plan_line_excel, network_family, plan_type, plan_name, days_raw, allowance_label, option_label,
      carrier_raw, data_class_raw, network_raw, internet_raw, qos_raw, validity_raw, apn_raw,
      install_benchmark_raw, activation_policy_raw, mcc_raw, mnc_raw, flags, price_block, raw_row,
      classification_conflict, classification_notes, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
      $25::jsonb,$26::jsonb,$27::jsonb,$28,$29,$30::timestamptz,$31::timestamptz
    )
    ON CONFLICT (option_api_id) DO UPDATE SET
      vendor_code = EXCLUDED.vendor_code,
      sim_kind = EXCLUDED.sim_kind,
      excel_update_type = EXCLUDED.excel_update_type,
      excel_sheet = EXCLUDED.excel_sheet,
      excel_sheet_language = EXCLUDED.excel_sheet_language,
      plan_line_excel = EXCLUDED.plan_line_excel,
      network_family = EXCLUDED.network_family,
      plan_type = EXCLUDED.plan_type,
      plan_name = EXCLUDED.plan_name,
      days_raw = EXCLUDED.days_raw,
      allowance_label = EXCLUDED.allowance_label,
      option_label = EXCLUDED.option_label,
      carrier_raw = EXCLUDED.carrier_raw,
      data_class_raw = EXCLUDED.data_class_raw,
      network_raw = EXCLUDED.network_raw,
      internet_raw = EXCLUDED.internet_raw,
      qos_raw = EXCLUDED.qos_raw,
      validity_raw = EXCLUDED.validity_raw,
      apn_raw = EXCLUDED.apn_raw,
      install_benchmark_raw = EXCLUDED.install_benchmark_raw,
      activation_policy_raw = EXCLUDED.activation_policy_raw,
      mcc_raw = EXCLUDED.mcc_raw,
      mnc_raw = EXCLUDED.mnc_raw,
      flags = EXCLUDED.flags,
      price_block = EXCLUDED.price_block,
      raw_row = EXCLUDED.raw_row,
      classification_conflict = EXCLUDED.classification_conflict,
      classification_notes = EXCLUDED.classification_notes,
      updated_at = EXCLUDED.updated_at`,
    [
      opt.option_api_id,
      opt.vendor_code,
      opt.sim_kind,
      opt.excel_update_type,
      opt.excel_sheet,
      opt.excel_sheet_language,
      opt.plan_line_excel,
      opt.network_family,
      opt.plan_type,
      opt.plan_name,
      opt.days_raw,
      opt.allowance_label,
      opt.option_label,
      opt.carrier_raw,
      opt.data_class_raw,
      opt.network_raw,
      opt.internet_raw,
      opt.qos_raw,
      opt.validity_raw,
      opt.apn_raw,
      opt.install_benchmark_raw,
      opt.activation_policy_raw,
      opt.mcc_raw,
      opt.mnc_raw,
      JSON.stringify(opt.flags),
      JSON.stringify(opt.price_block),
      JSON.stringify(opt.raw_row),
      opt.classification_conflict,
      opt.classification_notes,
      opt.created_at,
      opt.updated_at,
    ],
  );
}

async function insertPriceEventIfNeeded(
  client: PoolClient,
  workbook_id: string,
  sheet_name: string,
  option_api_id: string,
  nextBlock: BongsimProductOptionV1["price_block"],
  raw_row: Record<string, unknown>,
  oldPriceJson: string,
): Promise<boolean> {
  const newS = JSON.stringify(nextBlock);
  if (oldPriceJson === newS) return false;
  const row_hash = hashExcelRowStable(raw_row);
  await client.query(
    `INSERT INTO bongsim_product_option_price_event (option_api_id, workbook_id, sheet_name, row_hash, price_block)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [option_api_id, workbook_id, sheet_name, row_hash, newS],
  );
  return true;
}

export async function runExcelImportBuffer(buf: Buffer): Promise<RunExcelImportResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, error: "db_unconfigured" };

  let workbook;
  try {
    workbook = readWorkbookFromBuffer(buf);
  } catch (e) {
    return { ok: false, error: "parse_failed", message: e instanceof Error ? e.message : "read_failed" };
  }

  const workbook_id = workbookIdFromBuffer(buf);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1::text))`, [workbook_id]);

    const dup = await client.query(`SELECT 1 FROM bongsim_import_audit WHERE workbook_id = $1 LIMIT 1`, [workbook_id]);
    if (dup.rows.length > 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: "duplicate_import",
        workbook_id,
        message: "This workbook was already imported (audit row exists).",
      };
    }

    let rows_upserted = 0;
    let rows_skipped = 0;
    let price_events_written = 0;
    const sheet_stats: Record<string, { rows: number; upserted: number; skipped: number }> = {};

    for (const cfg of BONGSIM_INGEST_SHEETS) {
      if (!workbook.SheetNames.includes(cfg.sheet_name)) continue;
      const parsed = parseIngestSheet(workbook, cfg);
      if (!parsed) continue;
      const records = sheetRowsAsRecords(parsed);
      const st = { rows: records.length, upserted: 0, skipped: 0 };
      sheet_stats[cfg.sheet_name] = st;

      for (const rec of records) {
        const meta = { workbook_id, sheet_name: cfg.sheet_name, sheet_language: cfg.sheet_language, plan_line_excel: cfg.plan_line_excel };
        const opt = normalizeExcelRow(meta, rec);
        if (!opt.option_api_id || opt.option_api_id.length < 8) {
          st.skipped += 1;
          rows_skipped += 1;
          continue;
        }
        const prev = await client.query<{ price_block: unknown }>(
          `SELECT price_block FROM bongsim_product_option WHERE option_api_id = $1`,
          [opt.option_api_id],
        );
        const existed = prev.rows.length > 0;
        const oldPriceJson = existed ? JSON.stringify(prev.rows[0].price_block) : "";
        await upsertProductOption(client, opt);
        const wrote = await insertPriceEventIfNeeded(
          client,
          workbook_id,
          cfg.sheet_name,
          opt.option_api_id,
          opt.price_block,
          opt.raw_row,
          existed ? oldPriceJson : "",
        );
        if (wrote) price_events_written += 1;
        st.upserted += 1;
        rows_upserted += 1;
      }
    }

    await client.query(
      `INSERT INTO bongsim_import_audit (workbook_id, rows_upserted, rows_skipped, price_events_written, sheet_stats)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [workbook_id, rows_upserted, rows_skipped, price_events_written, JSON.stringify(sheet_stats)],
    );

    await client.query("COMMIT");
    return { ok: true, workbook_id, rows_upserted, rows_skipped, price_events_written, sheet_stats };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: "db_error", message: e instanceof Error ? e.message : "rollback" };
  } finally {
    client.release();
  }
}
