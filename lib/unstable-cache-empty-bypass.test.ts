import { describe, expect, it, vi } from "vitest";
import { readCachedArrayOrBypassEmpty } from "@/lib/unstable-cache-empty-bypass";

describe("readCachedArrayOrBypassEmpty", () => {
  // REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]
  it("returns cached when non-empty", async () => {
    const fresh = vi.fn(async () => [{ id: "fresh" }]);
    const out = await readCachedArrayOrBypassEmpty(async () => [{ id: "cached" }], fresh);
    expect(out).toEqual([{ id: "cached" }]);
    expect(fresh).not.toHaveBeenCalled();
  });

  it("bypasses to fresh when cached empty", async () => {
    const fresh = vi.fn(async () => [{ id: "recovered" }]);
    const out = await readCachedArrayOrBypassEmpty(async () => [], fresh);
    expect(out).toEqual([{ id: "recovered" }]);
    expect(fresh).toHaveBeenCalledOnce();
  });
});
