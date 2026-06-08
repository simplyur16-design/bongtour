import { describe, expect, it } from "vitest";
import { matchesBongsimPlanFilters } from "@/lib/bongsim/recommend/matches-plan-filters";

function row(
  plan_name: string,
  days_raw: string,
  plan_type: string | null = "unlimited",
  extra?: Partial<{
    network_family: string;
    allowance_label: string;
    option_label: string;
  }>,
) {
  return { plan_name, days_raw, plan_type, ...extra };
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

  it("로컬 시트(plan_type null) — 매일 용량 옵션은 daily로 해석해 통과", () => {
    const ok = matchesBongsimPlanFilters(
      row("유럽 33개국", "7일", null, {
        network_family: "local",
        allowance_label: "500MB",
        option_label: "7일 / 매일 500MB 이후 저속 무제한",
      }),
      {
        country: "rg-eu-33",
        days: 7,
        allSelected: ["rg-eu-33"],
      },
    );
    expect(ok).toBe(true);
  });

  it("로컬 시트(plan_type null) — 완전 무제한은 unlimited로 해석해 통과", () => {
    const ok = matchesBongsimPlanFilters(
      row("유럽 33개국", "7일", null, {
        network_family: "local",
        allowance_label: "완전 무제한",
        option_label: "7일 / 완전 무제한",
      }),
      {
        country: "rg-eu-33",
        days: 7,
        allSelected: ["rg-eu-33"],
      },
    );
    expect(ok).toBe(true);
  });
});
