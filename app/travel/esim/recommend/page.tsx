import { Suspense } from "react";
import Header from "@/app/components/Header";
import RecommendPageClient from "./RecommendPageClient";
import { loadBongsimRecommendBootstrapCached } from "@/lib/bongsim/data/load-recommend-bootstrap-cached";

// REGRESSION-FREEZE[bongsim-recommend-server-bootstrap-p3]: recommend 페이지 서버 프리로드 — manifest

export default async function RecommendPage() {
  const bootstrap = await loadBongsimRecommendBootstrapCached();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-600">
            불러오는 중…
          </main>
        </div>
      }
    >
      <RecommendPageClient
        initialCountries={bootstrap.ok ? bootstrap.data.countries : null}
        initialCatalogMeta={bootstrap.ok ? bootstrap.data.catalogMeta : null}
        initialHeroMap={bootstrap.ok ? bootstrap.data.heroMap : null}
        bootstrapError={bootstrap.ok ? null : bootstrap.reason}
      />
    </Suspense>
  );
}
