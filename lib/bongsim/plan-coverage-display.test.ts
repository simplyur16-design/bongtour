import { describe, expect, it } from "vitest";
import { coveragePreviewLabel, listCoverageCountries } from "@/lib/bongsim/plan-coverage-display";

describe("listCoverageCountries", () => {
  it("rg-eu-33 → 33개 한글 국가명", () => {
    const rows = listCoverageCountries({ destinationCode: "rg-eu-33" });
    expect(rows).toHaveLength(33);
    expect(rows.some((r) => r.nameKr === "프랑스")).toBe(true);
    expect(rows.some((r) => r.nameKr === "독일")).toBe(true);
  });

  it("rg-eu-42도 고객 안내는 33개국 목록으로 통일", () => {
    const rows = listCoverageCountries({ destinationCode: "rg-eu-42" });
    expect(rows).toHaveLength(33);
  });

  it("plan_name 직접 지정(비유럽)", () => {
    const rows = listCoverageCountries({ planName: "동남아 3개국" });
    expect(rows).toHaveLength(3);
  });

  it("rg-eu-27도 유럽 패키지면 33개국 목록", () => {
    expect(listCoverageCountries({ destinationCode: "rg-eu-27" })).toHaveLength(33);
  });
});

describe("coveragePreviewLabel", () => {
  it("미리보기 + 외 N개국", () => {
    const rows = listCoverageCountries({ destinationCode: "rg-eu-33" });
    const label = coveragePreviewLabel(rows, 3);
    expect(label).toMatch(/외 \d+개국$/);
  });
});
