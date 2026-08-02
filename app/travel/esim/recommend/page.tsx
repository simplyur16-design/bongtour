import Header from "@/app/components/Header";
import RecommendPageClient from "./RecommendPageClient";
import { loadBongsimRecommendBootstrapCached } from "@/lib/bongsim/data/load-recommend-bootstrap-cached";

// REGRESSION-FREEZE[bongsim-recommend-server-bootstrap-p3]: recommend 페이지 서버 프리로드 — manifest
// REGRESSION-FREEZE[bongsim-recommend-no-hard-refresh-spin]: fromCheckout 서버 전달·Suspense/useSearchParams 제거 — manifest

export default async function RecommendPage({
  searchParams,
}: {
  searchParams?: Promise<{ fromCheckout?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.fromCheckout;
  const fromCheckout = Array.isArray(raw) ? raw[0] === "1" : raw === "1";
  const bootstrap = await loadBongsimRecommendBootstrapCached();

  return (
    <RecommendPageClient
      fromCheckout={fromCheckout}
      initialCountries={bootstrap.ok ? bootstrap.data.countries : null}
      initialCatalogMeta={bootstrap.ok ? bootstrap.data.catalogMeta : null}
      initialHeroMap={bootstrap.ok ? bootstrap.data.heroMap : null}
      bootstrapError={bootstrap.ok ? null : bootstrap.reason}
    />
  );
}
