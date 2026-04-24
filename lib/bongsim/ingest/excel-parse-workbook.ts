import * as XLSX from "xlsx";
import type { BongsimIngestSheetConfig } from "@/lib/bongsim/ingest/excel-sheet-config";

export type ParsedSheetRows = {
  config: BongsimIngestSheetConfig;
  /** Exact header cell text → column index (first occurrence). */
  header_index: Map<string, number>;
  /** Raw matrix rows after header row (each row aligned to header columns). */
  data_rows: unknown[][];
};

function normHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/** Find header row (심타입 / SIm type) within first 8 rows. */
export function findHeaderRowIndex(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(8, matrix.length); i++) {
    const row = matrix[i] ?? [];
    for (const c of row) {
      const s = normHeader(c);
      if (s === "심타입" || s.includes("SIm type") || s === "Sim type") return i;
    }
  }
  return -1;
}

/**
 * 헤더 셀 문자열 → 열 인덱스.
 * 동일 헤더가 두 번 이상 나오면(예: "기존" / "변경" 구간에 같은 `소비자가(KRW)`),
 * Excel과 동일하게 두 번째부터 `이름.1`, `이름.2` 키를 붙여 `excel-map-columns`의
 * `소비자가(KRW).1` 등과 매칭되게 한다.
 */
export function matrixToHeaderIndexMap(headerRow: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  const occurrence = new Map<string, number>();
  headerRow.forEach((cell, j) => {
    const base = normHeader(cell);
    if (!base) return;
    const n = (occurrence.get(base) ?? 0) + 1;
    occurrence.set(base, n);
    const key = n === 1 ? base : `${base}.${n - 1}`;
    m.set(key, j);
  });
  return m;
}

export function extractSheetMatrix(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as unknown[][];
}

export function buildRowRecord(headerIndex: Map<string, number>, dataRow: unknown[]): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [header, col] of headerIndex) {
    rec[header] = dataRow[col] ?? null;
  }
  return rec;
}

export function sheetRowsAsRecords(parsed: ParsedSheetRows): Record<string, unknown>[] {
  return parsed.data_rows.map((row) => buildRowRecord(parsed.header_index, row));
}

export function parseIngestSheet(workbook: XLSX.WorkBook, config: BongsimIngestSheetConfig): ParsedSheetRows | null {
  const matrix = extractSheetMatrix(workbook, config.sheet_name);
  if (!matrix.length) return null;
  const hi = findHeaderRowIndex(matrix);
  if (hi < 0) return null;
  const headerRow = matrix[hi] ?? [];
  const header_index = matrixToHeaderIndexMap(headerRow);
  const data_rows: unknown[][] = [];
  for (let r = hi + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (!row.some((c) => c !== null && c !== undefined && String(c).trim() !== "")) continue;
    data_rows.push(row);
  }
  return { config, header_index, data_rows };
}

export function readWorkbookFromBuffer(buf: Buffer): XLSX.WorkBook {
  return XLSX.read(buf, { type: "buffer", cellDates: true });
}
