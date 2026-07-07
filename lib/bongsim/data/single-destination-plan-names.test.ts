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
  });

  it("권역 pack — 단일 plan_name", () => {
    expect(resolveDestinationPlanNamesForSql("rg-eu-42")).toEqual(["유럽 42개국"]);
  });

  it("알 수 없는 코드", () => {
    expect(resolveDestinationPlanNamesForSql("zzzzz")).toBeNull();
  });
});
