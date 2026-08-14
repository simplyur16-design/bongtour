import { describe, expect, it } from "vitest";
import {
  COMMON_FAQ,
  IOS_STEPS,
  PRECHECK_BLOCKS,
} from "@/lib/bongsim/esim-guide-content";

describe("esim-guide-content (roaming-style guest copy)", () => {
  it("precheck keeps fee-bomb / one-time QR / install timing callouts", () => {
    const blob = PRECHECK_BLOCKS.map((b) =>
      [b.heading, ...(b.paras ?? []), ...(b.bullets ?? []), b.note ?? ""].join("\n"),
    ).join("\n");
    expect(blob).toMatch(/요금/);
    expect(blob).toMatch(/1회성/);
    expect(blob).toMatch(/홍콩·마카오·대만/);
    expect(PRECHECK_BLOCKS.some((b) => b.image === "precheck_secure_network")).toBe(true);
  });

  it("iOS steps keep manifest image guideKeys", () => {
    const images = IOS_STEPS.flatMap((s) => s.blocks.map((b) => b.image).filter(Boolean));
    expect(images).toEqual(
      expect.arrayContaining([
        "ios_install_oneclick",
        "ios_activate_predeparture",
        "ios_activate_roaming",
        "ios_local_jp",
        "ios_delete",
      ]),
    );
  });

  it("common FAQ stays beginner-friendly", () => {
    const blob = COMMON_FAQ.map((f) => `${f.q}\n${f.a}`).join("\n");
    expect(blob).toMatch(/데이터 로밍/);
    expect(blob).toMatch(/비행기 모드|eSIM/);
  });
});
