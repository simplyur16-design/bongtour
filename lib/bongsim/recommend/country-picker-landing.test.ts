import { describe, expect, it } from "vitest";
import {
  esimCountryPickerBackAction,
  shouldRedirectRecommendToLandingPicker,
} from "@/lib/bongsim/recommend/country-picker-landing";
import { bongsimCountryPickerHref, ESIM_COUNTRY_PICKER_HASH } from "@/lib/bongsim/constants";

// REGRESSION-FREEZE[bongsim-esim-hero-country-picker-landing]: 히어로→랜딩 피커 — manifest

describe("country-picker-landing", () => {
  it("finder href is landing hash, not /recommend Step1", () => {
    expect(bongsimCountryPickerHref()).toBe(`/travel/esim#${ESIM_COUNTRY_PICKER_HASH}`);
    expect(bongsimCountryPickerHref()).not.toContain("/recommend");
  });

  it("bare /recommend without country redirects to landing picker", () => {
    expect(
      shouldRedirectRecommendToLandingPicker({ fromCheckout: false, countryCode: null }),
    ).toBe(true);
  });

  it("keeps product page when ?country= or checkout restore", () => {
    expect(
      shouldRedirectRecommendToLandingPicker({ fromCheckout: false, countryCode: "jp" }),
    ).toBe(false);
    expect(
      shouldRedirectRecommendToLandingPicker({ fromCheckout: true, countryCode: null }),
    ).toBe(false);
  });

  it("in-app back uses history when referrer is eSIM landing", () => {
    expect(
      esimCountryPickerBackAction({
        referrer: "https://bongtour.com/travel/esim#esim-countries",
        currentOrigin: "https://bongtour.com",
      }),
    ).toBe("history-back");
    expect(
      esimCountryPickerBackAction({
        referrer: "https://bongtour.com/travel/esim/recommend?country=jp",
        currentOrigin: "https://bongtour.com",
      }),
    ).toBe("assign-picker");
  });
});
