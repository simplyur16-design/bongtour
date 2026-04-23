import type { ExcelSheetLanguage, PlanLineExcel } from "@/lib/bongsim/contracts/public-enums";

export type BongsimExcelSourceMetaV1 = {
  workbook_id: string;
  sheet_name: string;
  sheet_language: ExcelSheetLanguage;
  plan_line_excel: PlanLineExcel;
};

export type BongsimIngestSheetConfig = {
  sheet_name: string;
  sheet_language: ExcelSheetLanguage;
  plan_line_excel: PlanLineExcel;
};

/** Sheets that share the standard SKU column layout (row-2 headers). */
export const BONGSIM_INGEST_SHEETS: BongsimIngestSheetConfig[] = [
  { sheet_name: "로컬(전체)", sheet_language: "ko", plan_line_excel: "로컬" },
  { sheet_name: "무제한(전체)", sheet_language: "ko", plan_line_excel: "무제한" },
  { sheet_name: "종량제(전체)", sheet_language: "ko", plan_line_excel: "종량제" },
  { sheet_name: "데일리(전체)", sheet_language: "ko", plan_line_excel: "데일리" },
  { sheet_name: "Local(all)", sheet_language: "en", plan_line_excel: "로컬" },
  { sheet_name: "Unlimited(all)", sheet_language: "en", plan_line_excel: "무제한" },
  { sheet_name: "Fix(all)", sheet_language: "en", plan_line_excel: "종량제" },
  { sheet_name: "daily (all)", sheet_language: "en", plan_line_excel: "데일리" },
];
