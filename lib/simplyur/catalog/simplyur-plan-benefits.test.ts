import { describe, expect, it } from "vitest";

import { containsHangul } from "@/lib/simplyur/display-guard";
import {
  SIMPLYUR_HOTSPOT_NOTE,
  SIMPLYUR_HOTSPOT_NOTE_KO,
  simplyurPlanBenefits,
} from "@/lib/simplyur/catalog/simplyur-plan-benefits";

describe("simplyurPlanBenefits", () => {
  it("marks Korea roaming whitelist plans as free Google Maps / ChatGPT data", () => {
    expect(simplyurPlanBenefits({ network_family: "roaming", plan_name: "대한민국" }, "en").free_apps_data).toBe(
      true,
    );
    expect(
      simplyurPlanBenefits({ network_family: "roaming", plan_name: "대한민국(3Mbps)" }, "en").free_apps_data,
    ).toBe(true);
  });

  it("does not mark local-network or unknown plans", () => {
    expect(simplyurPlanBenefits({ network_family: "local", plan_name: "대한민국" }, "en").free_apps_data).toBe(false);
    expect(simplyurPlanBenefits({ network_family: "roaming", plan_name: "unknown" }, "en").free_apps_data).toBe(false);
  });

  it("keeps the owner's hotspot wording as ko SSOT and localizes without Hangul", () => {
    expect(SIMPLYUR_HOTSPOT_NOTE_KO).toBe("핫스팟 사용 가능(통신사 정책에 따라 제한될 수 있음)");
    for (const note of Object.values(SIMPLYUR_HOTSPOT_NOTE)) {
      expect(note.length).toBeGreaterThan(5);
      expect(containsHangul(note)).toBe(false);
    }
    expect(simplyurPlanBenefits({ network_family: "local", plan_name: "x" }, "ja").hotspot_note).toBe(
      SIMPLYUR_HOTSPOT_NOTE.ja,
    );
  });

  it("shows the hotspot note on local-network plans as well as roaming, in every locale", () => {
    for (const [locale, note] of Object.entries(SIMPLYUR_HOTSPOT_NOTE)) {
      for (const network_family of ["roaming", "local"]) {
        expect(
          simplyurPlanBenefits({ network_family, plan_name: "대한민국" }, locale as keyof typeof SIMPLYUR_HOTSPOT_NOTE)
            .hotspot_note,
        ).toBe(note);
      }
    }
  });

  it("sets the unused-refund flag from the existing refund policy", () => {
    expect(simplyurPlanBenefits({ network_family: "roaming", plan_name: "x" }, "vi").unused_refund).toBe(true);
  });
});
