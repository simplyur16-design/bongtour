import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listWelcomepayOverlayCleanupSelectors,
  resetAfterPgOverlay,
} from "@/lib/bongsim/checkout/reset-after-pg-overlay";

// REGRESSION-FREEZE[welcomepay-esim-payment]: reset overlay on retry — manifest

describe("resetAfterPgOverlay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes cleanup selectors including inicis modal", () => {
    expect(listWelcomepayOverlayCleanupSelectors()).toContain("#inicisModalDiv");
    expect(listWelcomepayOverlayCleanupSelectors().some((s) => s.includes("paywelcome"))).toBe(true);
  });

  it("clears body scroll-lock styles and removes overlay nodes", () => {
    const removed: string[] = [];
    const bodyStyle: Record<string, string> = {
      overflow: "hidden",
      position: "fixed",
      top: "0px",
      width: "100%",
      "pointer-events": "none",
    };
    const htmlStyle: Record<string, string> = { overflow: "hidden" };
    const makeStyle = (bag: Record<string, string>) => ({
      removeProperty(key: string) {
        delete bag[key];
      },
    });
    const classList = { remove: vi.fn() };
    const overlay = {
      parentNode: {
        removeChild(el: unknown) {
          removed.push("overlay");
          return el;
        },
      },
    };
    vi.stubGlobal("document", {
      body: { style: makeStyle(bodyStyle), classList },
      documentElement: { style: makeStyle(htmlStyle), classList },
      querySelectorAll: (sel: string) => (sel === "#inicisModalDiv" ? [overlay] : []),
    });
    vi.stubGlobal("window", { scrollTo: vi.fn(), scrollY: 0 });

    resetAfterPgOverlay();

    expect(bodyStyle.overflow).toBeUndefined();
    expect(bodyStyle.position).toBeUndefined();
    expect(bodyStyle["pointer-events"]).toBeUndefined();
    expect(htmlStyle.overflow).toBeUndefined();
    expect(removed).toEqual(["overlay"]);
    expect(classList.remove).toHaveBeenCalled();
  });
});
