"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Header from "@/app/components/Header";
import { ProductCatalogCard } from "@/components/bongsim/catalog/ProductCatalogCard";
import { bongsimPath } from "@/lib/bongsim/constants";
import {
  CATALOG_BUCKET_META,
  CATALOG_BUCKET_ORDER,
  CATALOG_PAGE_SIZE,
  type CatalogBucketKey,
} from "@/lib/bongsim/catalog/catalog-buckets";
import type { CatalogBucketCounts, CatalogKycByPlanName, CatalogProductListRow } from "@/lib/bongsim/data/list-catalog-products";
import type { KycLabelDistribution } from "@/lib/bongsim/esim/kyc-required";

// REGRESSION-FREEZE[bongsim-catalog-client-pagination-p4]: client paginated catalog — manifest

type BucketState = {
  items: CatalogProductListRow[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

type ApiPayload = {
  schema?: string;
  items?: CatalogProductListRow[];
  total?: number;
  page?: number;
  page_size?: number;
  bucket?: CatalogBucketKey;
  error?: string;
};

function emptyBucketState(): BucketState {
  return { items: [], total: 0, loading: false, loadingMore: false, error: null };
}

type Props = {
  initialBucketCounts: CatalogBucketCounts | null;
  initialKycByPlanName: CatalogKycByPlanName | null;
  bootstrapError: "db_unconfigured" | "db_error" | null;
};

export default function CatalogPageClient({
  initialBucketCounts,
  initialKycByPlanName,
  bootstrapError,
}: Props) {
  const [bucketCounts] = useState<CatalogBucketCounts | null>(initialBucketCounts);
  const [kycByPlanName] = useState<CatalogKycByPlanName | null>(initialKycByPlanName);
  const [bucketState, setBucketState] = useState<Record<CatalogBucketKey, BucketState>>(() =>
    Object.fromEntries(CATALOG_BUCKET_ORDER.map((k) => [k, emptyBucketState()])) as Record<
      CatalogBucketKey,
      BucketState
    >,
  );

  const fetchBucketPage = useCallback(async (bucket: CatalogBucketKey, offset: number, append: boolean) => {
    setBucketState((prev) => ({
      ...prev,
      [bucket]: {
        ...prev[bucket],
        loading: !append,
        loadingMore: append,
        error: null,
      },
    }));

    const q = new URLSearchParams({
      bucket,
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(offset),
    });

    try {
      const res = await fetch(`/api/bongsim/products?${q}`);
      const json = (await res.json()) as ApiPayload;
      if (!res.ok) {
        throw new Error(json.error ?? "load_failed");
      }
      const items = json.items ?? [];
      const total = typeof json.total === "number" ? json.total : items.length;
      setBucketState((prev) => ({
        ...prev,
        [bucket]: {
          items: append ? [...prev[bucket].items, ...items] : items,
          total,
          loading: false,
          loadingMore: false,
          error: null,
        },
      }));
    } catch {
      setBucketState((prev) => ({
        ...prev,
        [bucket]: {
          ...prev[bucket],
          loading: false,
          loadingMore: false,
          error: "목록을 불러오지 못했습니다.",
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (bootstrapError) return;
    for (const bucket of CATALOG_BUCKET_ORDER) {
      const count = bucketCounts?.[bucket] ?? 0;
      if (count > 0) {
        void fetchBucketPage(bucket, 0, false);
      }
    }
  }, [bootstrapError, bucketCounts, fetchBucketPage]);

  const totalProducts = bucketCounts
    ? CATALOG_BUCKET_ORDER.reduce((sum, key) => sum + (bucketCounts[key] ?? 0), 0)
    : 0;

  if (bootstrapError) {
    return (
      <div className="min-h-screen bg-bt-page">
        <Header />
        <div className="min-h-full bg-slate-50">
          <main className="mx-auto max-w-3xl px-4 py-10">
            <h1 className="text-lg font-semibold text-slate-900">요금제 목록</h1>
            <p className="mt-3 text-sm text-slate-600">
              {bootstrapError === "db_unconfigured"
                ? "DATABASE_URL이 설정되지 않았거나 DB에 연결할 수 없습니다."
                : "목록을 불러오지 못했습니다."}
            </p>
            <Link href={bongsimPath()} className="mt-6 inline-block text-sm text-teal-800 underline">
              홈으로
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <div className="min-h-full bg-slate-50">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
          <nav className="text-[12px] text-slate-500">
            <Link href={bongsimPath()} className="hover:text-teal-800">
              홈
            </Link>
            <span className="mx-1.5 text-slate-300">/</span>
            <span className="text-slate-800">요금제</span>
          </nav>
          <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-slate-900">요금제 목록</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Excel에서 반영된 상품 옵션을 망·플랜 유형별로 묶어 보여줍니다. 카드를 누르면 상세 페이지로 이동합니다.
          </p>

          <div className="mt-10 space-y-12">
            {CATALOG_BUCKET_ORDER.map((key) => {
              const count = bucketCounts?.[key] ?? 0;
              if (!count) return null;
              const meta = CATALOG_BUCKET_META[key];
              const state = bucketState[key];
              const kycMap = kycByPlanName ?? {};
              const hasMore = state.items.length < state.total;

              return (
                <section key={key} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {meta.description}
                      <span className="ml-2 tabular-nums text-slate-400">({count.toLocaleString("ko-KR")}개)</span>
                    </p>
                  </div>

                  {state.error ? (
                    <p className="text-sm text-red-600">{state.error}</p>
                  ) : null}

                  {state.loading && !state.items.length ? (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <li
                          key={i}
                          className="h-28 animate-pulse rounded-2xl border border-slate-200/90 bg-white"
                        />
                      ))}
                    </ul>
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {state.items.map((row) => (
                        <li key={row.option_api_id}>
                          <ProductCatalogCard
                            row={row}
                            kycDistribution={(kycMap[row.plan_name] ?? "none") as KycLabelDistribution}
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {hasMore ? (
                    <button
                      type="button"
                      disabled={state.loadingMore}
                      onClick={() => void fetchBucketPage(key, state.items.length, true)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-900 disabled:opacity-60"
                    >
                      {state.loadingMore ? "불러오는 중…" : `더 보기 (${state.items.length}/${state.total})`}
                    </button>
                  ) : null}
                </section>
              );
            })}
          </div>

          {totalProducts === 0 ? (
            <p className="mt-10 text-sm text-slate-600">
              등록된 상품이 없습니다. 내부 Excel 가져오기를 먼저 실행해 주세요.
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
