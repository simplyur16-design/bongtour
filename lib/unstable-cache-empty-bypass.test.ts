import { describe, expect, it, vi } from "vitest";
import {
  readCachedArrayOrBypassEmpty,
  readCachedSectionsOrBypassAllEmpty,
} from "@/lib/unstable-cache-empty-bypass";

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

describe("readCachedSectionsOrBypassAllEmpty", () => {
  // REGRESSION-FREEZE[home-ssg-empty-poison]
  it("keeps cached when any review section has items", async () => {
    const fresh = vi.fn(async () => ({ packageReviews: [{ id: "p" }], groupReviews: [{ id: "g" }] }));
    const out = await readCachedSectionsOrBypassAllEmpty(
      async () => ({ packageReviews: [{ id: "cached" }], groupReviews: [] }),
      fresh,
      ["packageReviews", "groupReviews"] as const,
    );
    expect(out).toEqual({ packageReviews: [{ id: "cached" }], groupReviews: [] });
    expect(fresh).not.toHaveBeenCalled();
  });

  it("bypasses to fresh when all review sections empty", async () => {
    const fresh = vi.fn(async () => ({ packageReviews: [{ id: "p" }], groupReviews: [{ id: "g" }] }));
    const out = await readCachedSectionsOrBypassAllEmpty(
      async () => ({ packageReviews: [], groupReviews: [] }),
      fresh,
      ["packageReviews", "groupReviews"] as const,
    );
    expect(out).toEqual({ packageReviews: [{ id: "p" }], groupReviews: [{ id: "g" }] });
    expect(fresh).toHaveBeenCalledOnce();
  });
});
