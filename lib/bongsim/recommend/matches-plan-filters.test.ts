import { describe, expect, it } from "vitest";
import { matchesBongsimPlanFilters } from "@/lib/bongsim/recommend/matches-plan-filters";

function row(plan_name: string, days_raw: string, plan_type = "unlimited") {
  return { plan_name, days_raw, plan_type };
}

describe("matchesBongsimPlanFilters", () => {
  it("단일 지역 패키지(rg-eu-33) — plan_name 일치·일수 이상이면 통과", () => {
    const ok = matchesBongsimPlanFilters(row("유럽 33개국", "7일"), {
      country: "rg-eu-33",
      days: 5,
      allSelected: ["rg-eu-33"],
    });
    expect(ok).toBe(true);
  });

  it("단일 지역 패키지 — 여행 일수보다 짧은 catalog 일수는 제외", () => {
    const ok = matchesBongsimPlanFilters(row("유럽 33개국", "3일"), {
      country: "rg-eu-33",
      days: 5,
      allSelected: ["rg-eu-33"],
    });
    expect(ok).toBe(false);
  });

  it("단일 지역 패키지 — 다른 plan_name은 제외", () => {
    const ok = matchesBongsimPlanFilters(row("유럽 42개국", "7일"), {
      country: "rg-eu-33",
      days: 5,
      allSelected: ["rg-eu-33"],
    });
    expect(ok).toBe(false);
  });

  it("단일 ISO 국가 — 기존 동작 유지", () => {
    const ok = matchesBongsimPlanFilters(row("일본", "5일"), {
      country: "jp",
      days: 4,
      allSelected: ["jp"],
    });
    expect(ok).toBe(true);
  });

  it("다국가 2개국 — 커버 플랜만 통과", () => {
    const ok = matchesBongsimPlanFilters(row("유럽 33개국", "10일"), {
      country: "fr",
      days: 7,
      allSelected: ["fr", "de"],
    });
    expect(ok).toBe(true);
  });
});
