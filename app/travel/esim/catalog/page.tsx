import { Suspense } from "react";
import type { Metadata } from "next";
import CatalogPageClient from "./CatalogPageClient";
import { loadCatalogPageBootstrapCached } from "@/lib/bongsim/data/load-catalog-page-bootstrap-cached";

// REGRESSION-FREEZE[bongsim-catalog-client-pagination-p4]: thin SSR shell — manifest

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
