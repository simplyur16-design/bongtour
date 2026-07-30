import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  // 실제 unstable_cache 와 동일하게 "반환값만" 통과시키고 throw 는 그대로 전파한다.
  unstable_cache: (fn: () => unknown) => fn,
}));

const loadSimplyurKoreaCatalog = vi.fn();
vi.mock("@/lib/simplyur/catalog/load-korea-catalog", () => ({
  loadSimplyurKoreaCatalog: (locale: string) => loadSimplyurKoreaCatalog(locale),
}));

const { CATALOG_REVALIDATE_SEC, loadSimplyurKoreaCatalogCached } = await import(
  "@/lib/simplyur/catalog/load-korea-catalog-cached"
);

describe("simplyur catalog cache P0", () => {
  it("카탈로그 revalidate 120초", () => {
    expect(CATALOG_REVALIDATE_SEC).toBe(120);
  });
});

// REGRESSION-FREEZE[simplyur-catalog-pool-resilience]: DB 실패는 캐시하지 않음 — manifest
describe("loadSimplyurKoreaCatalogCached — 실패 처리", () => {
  beforeEach(() => {
    loadSimplyurKoreaCatalog.mockReset();
  });

  it("성공 결과를 그대로 돌려준다", async () => {
    const pack = { roaming: { min_price_krw: null, min_display: null, products: [] }, local: null };
    loadSimplyurKoreaCatalog.mockResolvedValue({ ok: true, locale: "en", pack });

    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: true,
      locale: "en",
      pack,
    });
  });

  it("connect timeout 을 캐시하지 않고 매번 로더를 다시 호출한다", async () => {
    loadSimplyurKoreaCatalog.mockResolvedValue({ ok: false, reason: "connection_timeout" });

    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "connection_timeout",
    });
    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "connection_timeout",
    });
    expect(loadSimplyurKoreaCatalog).toHaveBeenCalledTimes(2);
  });

  it("db_unconfigured·db_error 이유를 보존한다", async () => {
    loadSimplyurKoreaCatalog.mockResolvedValue({ ok: false, reason: "db_unconfigured" });
    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "db_unconfigured",
    });

    loadSimplyurKoreaCatalog.mockResolvedValue({ ok: false, reason: "db_error" });
    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "db_error",
    });
  });
});
