import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

vi.mock("next/cache", () => ({
  // 실제 unstable_cache 와 동일하게 "반환값만" 통과시키고 throw 는 그대로 전파한다.
  unstable_cache: (fn: () => unknown) => fn,
}));

vi.mock("@/lib/bongsim/db/pool", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bongsim/db/pool")>("@/lib/bongsim/db/pool");
  return {
    ...actual,
    probePgPoolTlsOrFallback: vi.fn(async () => {}),
    healBongsimPgPoolForCatalog: vi.fn(async () => {}),
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
const loadSimplyurKoreaProductByOptionId = vi.fn();
vi.mock("@/lib/simplyur/catalog/load-korea-catalog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/simplyur/catalog/load-korea-catalog")>(
    "@/lib/simplyur/catalog/load-korea-catalog",
  );
  return {
    ...actual,
    loadSimplyurKoreaActiveProducts: () => loadSimplyurKoreaActiveProducts(),
    loadSimplyurKoreaProductByOptionId: (...args: unknown[]) =>
      loadSimplyurKoreaProductByOptionId(...args),
  };
});

const {
  CATALOG_REVALIDATE_SEC,
  loadSimplyurKoreaCatalogCached,
  loadSimplyurKoreaProductByOptionIdCached,
} = await import("@/lib/simplyur/catalog/load-korea-catalog-cached");
const { findKoreaCatalogProductByOptionId } = await import("@/lib/simplyur/catalog/load-korea-catalog");

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

function koreaSku(option_api_id: string): ProductOption {
  return {
    option_api_id,
    plan_name: "대한민국",
    network_family: "roaming",
    plan_type: "data",
    days_raw: "5일",
    allowance_label: "1GB",
    option_label: "5일",
    price_block: { after: { consumer_krw: 10000 } },
    flags: {},
  };
}

// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: list cache → detail — manifest
describe("loadSimplyurKoreaProductByOptionIdCached — 목록과 같은 파이프", () => {
  beforeEach(() => {
    loadSimplyurKoreaActiveProducts.mockReset();
    loadSimplyurKoreaProductByOptionId.mockReset();
  });

  it("findKoreaCatalogProductByOptionId matches UUID case-insensitively", () => {
    const id = "206E9DD1-4361-F011-8F7C-6045BD461BFF";
    const row = findKoreaCatalogProductByOptionId([koreaSku(id)], id.toLowerCase());
    expect(row?.option_api_id).toBe(id);
  });

  it("목록 캐시에 있는 SKU는 DB 단건 조회를 치지 않는다", async () => {
    const id = "206E9DD1-4361-F011-8F7C-6045BD461BFF";
    loadSimplyurKoreaActiveProducts.mockResolvedValue({ ok: true, products: [koreaSku(id)] });

    const loaded = await loadSimplyurKoreaProductByOptionIdCached(id, "en");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.product.option_api_id).toBe(id);
    expect(loadSimplyurKoreaProductByOptionId).not.toHaveBeenCalled();
  });

  it("캐시에 없으면 DB 단건으로 넘어간다", async () => {
    loadSimplyurKoreaActiveProducts.mockResolvedValue({ ok: true, products: [] });
    loadSimplyurKoreaProductByOptionId.mockResolvedValue({ ok: false, reason: "not_found" });

    await expect(loadSimplyurKoreaProductByOptionIdCached("missing-id", "en")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(loadSimplyurKoreaProductByOptionId).toHaveBeenCalledTimes(1);
  });

  it("캐시가 EMAXCONN이면 DB를 한 번 더 치고 timeout이면 heal 후 재시도한다", async () => {
    loadSimplyurKoreaActiveProducts.mockResolvedValue({ ok: false, reason: "connection_timeout" });
    loadSimplyurKoreaProductByOptionId
      .mockResolvedValueOnce({ ok: false, reason: "connection_timeout" })
      .mockResolvedValueOnce({ ok: false, reason: "connection_timeout" });

    await expect(
      loadSimplyurKoreaProductByOptionIdCached("206E9DD1-4361-F011-8F7C-6045BD461BFF", "en"),
    ).resolves.toEqual({ ok: false, reason: "connection_timeout" });
    expect(loadSimplyurKoreaProductByOptionId).toHaveBeenCalledTimes(2);
  });
});
