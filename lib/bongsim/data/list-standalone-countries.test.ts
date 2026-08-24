import { describe, expect, it } from "vitest";
import { standaloneCountriesFromPlanNames } from "@/lib/bongsim/data/list-standalone-countries";

// REGRESSION-FREEZE[bongsim-caucasus-transit-pack]: 코카서스 팩으로 빈 국가 타일 금지 — manifest

describe("standaloneCountriesFromPlanNames", () => {
  it("does not invent Armenia/Azerbaijan tiles from the Caucasus region pack", () => {
    const countries = standaloneCountriesFromPlanNames(["코카서스 3국(경유팩)", "코카서스 3개국(경유팩)", "일본"]);
    expect(countries.map((c) => c.code).sort()).toEqual(["jp"]);
  });

  it("maps 조지아(경유팩) onto Georgia only", () => {
    const countries = standaloneCountriesFromPlanNames(["조지아(경유팩)"]);
    expect(countries.map((c) => c.code)).toEqual(["ge"]);
  });
});
