import { afterEach, describe, expect, it, vi } from "vitest";
import {
  breakOutOfPgFrameIfNeeded,
  listWelcomepayOverlayCleanupSelectors,
  navigateTopHard,
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
    expect(listWelcomepayOverlayCleanupSelectors()).toContain("#allat_div");
  });

  it("welcomepayOverlayPresentSelector includes paywelcome_modal", async () => {
    const { welcomepayOverlayPresentSelector } = await import(
      "@/lib/bongsim/checkout/reset-after-pg-overlay"
    );
    expect(welcomepayOverlayPresentSelector()).toContain("#paywelcome_modal");
    expect(welcomepayOverlayPresentSelector()).toContain("#inicisModalDiv");
  });

  it("clears body scroll-lock styles and removes overlay nodes", () => {
    const removed: string[] = [];
    const bodyStyle: Record<string, string> = {
      overflow: "hidden",
      position: "fixed",
      top: "-240px",
      width: "100%",
      "pointer-events": "none",
    };
    const htmlStyle: Record<string, string> = { overflow: "hidden" };
    const makeStyle = (bag: Record<string, string>) => ({
      get top() {
        return bag.top ?? "";
      },
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
    const scrollTo = vi.fn();
    vi.stubGlobal("document", {
      body: { style: makeStyle(bodyStyle), classList },
      documentElement: { style: makeStyle(htmlStyle), classList },
      querySelectorAll: (sel: string) => (sel === "#inicisModalDiv" ? [overlay] : []),
    });
    vi.stubGlobal("window", { scrollTo, scrollY: 0, top: null });

    resetAfterPgOverlay();

    expect(bodyStyle.overflow).toBeUndefined();
    expect(bodyStyle.position).toBeUndefined();
    expect(bodyStyle["pointer-events"]).toBeUndefined();
    expect(htmlStyle.overflow).toBeUndefined();
    expect(removed).toEqual(["overlay"]);
    expect(classList.remove).toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it("breakOutOfPgFrameIfNeeded replaces same-origin top when nested", () => {
    const replace = vi.fn();
    const topDoc = {
      body: { style: { removeProperty: vi.fn() }, classList: { remove: vi.fn() } },
      documentElement: { style: { removeProperty: vi.fn() }, classList: { remove: vi.fn() } },
      querySelectorAll: () => [],
      location: { href: "https://example.com/parent" },
    };
    const topWin = {
      document: topDoc,
      location: { href: "https://example.com/parent", replace },
      scrollTo: vi.fn(),
      scrollY: 0,
    };
    vi.stubGlobal("document", {
      body: { style: { removeProperty: vi.fn(), top: "" }, classList: { remove: vi.fn() } },
      documentElement: { style: { removeProperty: vi.fn() }, classList: { remove: vi.fn() } },
      querySelectorAll: () => [],
    });
    vi.stubGlobal("window", {
      top: topWin,
      location: { href: "https://example.com/result?status=fail" },
      scrollTo: vi.fn(),
      scrollY: 0,
    });

    expect(breakOutOfPgFrameIfNeeded()).toBe(true);
    expect(replace).toHaveBeenCalledWith("https://example.com/result?status=fail");
  });

  it("navigateTopHard assigns on top window", () => {
    const assign = vi.fn();
    vi.stubGlobal("document", {
      body: { style: { removeProperty: vi.fn(), top: "" }, classList: { remove: vi.fn() } },
      documentElement: { style: { removeProperty: vi.fn() }, classList: { remove: vi.fn() } },
      querySelectorAll: () => [],
    });
    vi.stubGlobal("window", {
      top: { location: { assign }, document: null, scrollTo: vi.fn(), scrollY: 0 },
      location: { assign: vi.fn() },
      scrollTo: vi.fn(),
      scrollY: 0,
    });
    // top.document null → sameOriginTop fails; navigate still uses window.top.location.assign
    navigateTopHard("/travel/esim/checkout?orderId=x");
    expect(assign).toHaveBeenCalledWith("/travel/esim/checkout?orderId=x");
  });
});
