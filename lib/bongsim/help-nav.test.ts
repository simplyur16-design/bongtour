import { describe, expect, it } from "vitest";
import { HELP_MENU_ITEMS, HELP_MENU_SUBPATHS } from "@/lib/bongsim/help-nav";
import { bongsimPath } from "@/lib/bongsim/constants";

describe("HELP_MENU_ITEMS", () => {
  it("uses /travel/esim/help prefix, never bare /help", () => {
    expect(HELP_MENU_ITEMS).toHaveLength(4);
    for (const item of HELP_MENU_ITEMS) {
      expect(item.href.startsWith("/travel/esim/help/")).toBe(true);
      expect(item.href.startsWith("/help/")).toBe(false);
    }
    expect(HELP_MENU_ITEMS.map((i) => i.href)).toEqual(HELP_MENU_SUBPATHS.map((s) => bongsimPath(s)));
  });
});
