import { describe, expect, it } from "vitest";
import {
  SIMPLYUR_AUDIENCE,
  SIMPLYUR_DOMESTIC_ESIM_HREF,
  SIMPLYUR_DOMESTIC_SIGNIN_HREF,
  SIMPLYUR_LOCALES,
} from "@/lib/simplyur/constants";

describe("simplyur constants — foreign audience SSOT", () => {
  it("fixes audience as foreign visitors Korea eSIM only", () => {
    expect(SIMPLYUR_AUDIENCE).toBe("foreign-visitors-korea-esim");
    expect(SIMPLYUR_DOMESTIC_ESIM_HREF).toBe("/travel/esim");
    expect(SIMPLYUR_DOMESTIC_SIGNIN_HREF).toBe("/auth/signin");
  });

  it("uses non-Korean UI locales only", () => {
    expect(SIMPLYUR_LOCALES).toEqual(["en", "ja", "zh", "zh-TW", "vi"]);
    expect(SIMPLYUR_LOCALES).not.toContain("ko");
  });
});
