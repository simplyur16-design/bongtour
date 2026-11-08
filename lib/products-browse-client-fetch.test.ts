import { afterEach, describe, expect, it, vi } from "vitest";
import { publicProductPath } from "@/lib/product-public-path";
import { buildProductsBrowseQueryKey } from "@/lib/products-browse-hub-query";
import { fetchProductsBrowseClientJson } from "@/lib/products-browse-client-fetch";

describe("products browse empty query key", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the default list when /products has no query", async () => {
    const urls: string[] = [];
    vi.stubGlobal("window", {
      setTimeout: (fn: TimerHandler, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return {
          ok: true,
          json: async () => ({ ok: true, items: [{ id: "p1", slug: "pkg-nl-0034" }] }),
        };
      }),
    );

    const json = await fetchProductsBrowseClientJson(buildProductsBrowseQueryKey(""));
    expect(json.items).toHaveLength(1);
    expect(urls).toEqual(["/api/products/browse"]);
  });

  it("keeps a filtered browse key and the product detail path", async () => {
    const urls: string[] = [];
    vi.stubGlobal("window", {
      setTimeout: (fn: TimerHandler, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return {
          ok: true,
          json: async () => ({ ok: true, items: [{ id: "p1", slug: "pkg-nl-0034" }] }),
        };
      }),
    );

    const key = buildProductsBrowseQueryKey("country=jp");
    expect(key).toContain("country=jp");
    await fetchProductsBrowseClientJson(key);
    expect(urls).toEqual([`/api/products/browse?${key}`]);
    expect(publicProductPath({ id: "p1", slug: "pkg-nl-0034" })).toBe("/products/pkg-nl-0034");
  });
});
