import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  // 실제 unstable_cache 와 동일하게 "반환값만" 통과시키고 throw 는 그대로 전파한다.
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/bongsim/db/pool", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bongsim/db/pool")>("@/lib/bongsim/db/pool");
  return {
    ...actual,
    probePgPoolTlsOrFallback: vi.fn(async () => {}),
    closePgPool: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/simplyur/fx-rates", () => ({
  resolveSimplyurFxRates: vi.fn(async () => ({
    USD: 1350,
    JPY: 9,
    CNY: 190,
    TWD: 42,
    VND: 0.053,
  })),
}));

const loadSimplyurKoreaActiveProducts = vi.fn();
vi.mock("@/lib/simplyur/catalog/load-korea-catalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/simplyur/catalog/load-korea-catalog")>(
    "@/lib/simplyur/catalog/load-korea-catalog",
  );
  return {
    ...actual,
    loadSimplyurKoreaActiveProducts: () => loadSimplyurKoreaActiveProducts(),
  };
});

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
    loadSimplyurKoreaActiveProducts.mockReset();
  });

  it("성공 결과를 locale pack으로 돌려준다", async () => {
    loadSimplyurKoreaActiveProducts.mockResolvedValue({ ok: true, products: [] });

    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toMatchObject({
      ok: true,
      locale: "en",
      pack: {
        roaming: { products: [] },
        local: null,
      },
    });
  });

  it("connect timeout 을 캐시하지 않고 heal 후 재시도한다", async () => {
    loadSimplyurKoreaActiveProducts
      .mockResolvedValueOnce({ ok: false, reason: "connection_timeout" })
      .mockResolvedValueOnce({ ok: false, reason: "connection_timeout" });

    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "connection_timeout",
    });
    // cache 경로 1회 + outer heal retry 1회
    expect(loadSimplyurKoreaActiveProducts).toHaveBeenCalledTimes(2);
  });

  it("db_unconfigured·db_error 이유를 보존한다", async () => {
    loadSimplyurKoreaActiveProducts
      .mockResolvedValueOnce({ ok: false, reason: "db_unconfigured" })
      .mockResolvedValueOnce({ ok: false, reason: "db_unconfigured" });
    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "db_unconfigured",
    });

    loadSimplyurKoreaActiveProducts.mockReset();
    loadSimplyurKoreaActiveProducts
      .mockResolvedValueOnce({ ok: false, reason: "db_error" })
      .mockResolvedValueOnce({ ok: false, reason: "db_error" });
    await expect(loadSimplyurKoreaCatalogCached("en")).resolves.toEqual({
      ok: false,
      reason: "db_error",
    });
  });
});
