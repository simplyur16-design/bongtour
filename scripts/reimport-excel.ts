import { createHash } from "node:crypto";
import fs from "fs";
import { closePgPool, getPgPool } from "../lib/bongsim/db/pool";
import { runExcelImportBuffer } from "../lib/bongsim/ingest/run-excel-import";

const XLSX_PATH = "C:\\Users\\USER\\Downloads\\20260316_공급가(전체).xlsx";

function workbookIdFromBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

async function main() {
  const buf = fs.readFileSync(XLSX_PATH);
  const force = process.argv.includes("--force");

  if (force) {
    const pool = getPgPool();
    if (!pool) {
      console.error("DB pool 없음 (--force 시 감사 삭제 불가)");
      process.exit(1);
    }
    const workbook_id = workbookIdFromBuffer(buf);
    const c = await pool.connect();
    try {
      await c.query("DELETE FROM bongsim_import_audit WHERE workbook_id = $1", [workbook_id]);
      console.log("기존 import 감사 행 삭제:", workbook_id);
    } finally {
      c.release();
    }
  }

  const result = await runExcelImportBuffer(buf);
  console.log("임포트 완료:", JSON.stringify(result, null, 2));
  await closePgPool();
  process.exit(0);
}

main().catch((e) => {
  console.error("임포트 실패:", e);
  process.exit(1);
});
