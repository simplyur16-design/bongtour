import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import CatalogPageClient from "./CatalogPageClient";
import { loadCatalogPageBootstrapCached } from "@/lib/bongsim/data/load-catalog-page-bootstrap-cached";

// REGRESSION-FREEZE[bongsim-catalog-client-pagination-p4]: thin SSR shell — manifest
// REGRESSION-FREEZE[build-ssg-skip-db]: catalog connection() — build SSG bongsim pool timeout 방지 — manifest

export const metadata: Metadata = {
  title: "eSIM 요금제 목록 | Bong투어 eSIM",
  description: "국가·일수·용량별 해외여행 eSIM 요금제를 비교하고 바로 구매하세요.",
  alternates: { canonical: "/travel/esim/catalog" },
  openGraph: {
    title: "eSIM 요금제 목록 | Bong투어 eSIM",
    description: "국가·일수·용량별 해외여행 eSIM 요금제를 비교하고 바로 구매하세요.",
    url: "/travel/esim/catalog",
    type: "website",
  },
};

export default async function CatalogPage() {
  // next build SSG에서 bongsim pool connection_timeout(60s)로 빌드가 깨지지 않게 요청 시점으로 미룸
  await connection();
  const bootstrap = await loadCatalogPageBootstrapCached();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-slate-600">
            불러오는 중…
          </main>
        </div>
      }
    >
      <CatalogPageClient
        initialBucketCounts={bootstrap.ok ? bootstrap.data.bucketCounts : null}
        initialKycByPlanName={bootstrap.ok ? bootstrap.data.kycByPlanName : null}
        bootstrapError={bootstrap.ok ? null : bootstrap.reason}
      />
    </Suspense>
  );
}
