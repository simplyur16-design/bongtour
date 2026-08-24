import { describe, expect, it } from "vitest";
import { normalizeExcelRow } from "@/lib/bongsim/ingest/excel-normalize-row";

describe("normalizeExcelRow request_shipment", () => {
  it("reads 요청(발송) with a newline in the Korean header", () => {
    const opt = normalizeExcelRow(
      {
        workbook_id: "test",
        sheet_name: "데일리(전체)",
        sheet_language: "ko",
        plan_line_excel: "데일리",
      },
      {
        "옵션ID(API)": "OPT-1",
        플랜명: "일본",
        "요청\n(발송)": "O",
      },
    );
    expect(opt.flags.request_shipment).toBe("O");
  });
});
