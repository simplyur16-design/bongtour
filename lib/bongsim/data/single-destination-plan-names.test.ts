import { describe, expect, it } from "vitest";
import { resolveDestinationPlanNamesForSql } from "@/lib/bongsim/data/single-destination-plan-names";

describe("resolveDestinationPlanNamesForSql", () => {
  it("일본 — COUNTRY_OPTIONS nameKr", () => {
    expect(resolveDestinationPlanNamesForSql("jp")).toEqual(["일본"]);
  });

  it("한국 — alias 포함", () => {
    const names = resolveDestinationPlanNamesForSql("kr");
    expect(names).toContain("대한민국");
    expect(names).toContain("한국");
    expect(names).toContain("대한민국(3Mbps)");
    expect(names).not.toContain("한국/일본");
    expect(names).not.toContain("한국/중국/일본");
  });

  it("권역 pack — 단일 plan_name", () => {
    expect(resolveDestinationPlanNamesForSql("rg-eu-42")).toEqual(["유럽 42개국"]);
  });

  it("조지아(경유팩) is in Georgia destination SQL names", () => {
    const names = resolveDestinationPlanNamesForSql("ge");
    expect(names).toContain("조지아");
    expect(names).toContain("조지아(경유팩)");
  });

  it("코카서스 권역 SQL names include both excel spellings", () => {
    const names = resolveDestinationPlanNamesForSql("rg-caucasus-3");
    expect(names).toEqual(["코카서스 3국(경유팩)", "코카서스 3개국(경유팩)"]);
  });

  it("알 수 없는 코드", () => {
    expect(resolveDestinationPlanNamesForSql("zzzzz")).toBeNull();
  });
});
