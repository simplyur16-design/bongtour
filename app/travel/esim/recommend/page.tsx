import type { Metadata } from "next";
import RecommendPageClient from "./RecommendPageClient";
import { loadBongsimRecommendBootstrapCached } from "@/lib/bongsim/data/load-recommend-bootstrap-cached";

// REGRESSION-FREEZE[bongsim-recommend-server-bootstrap-p3]: recommend 페이지 서버 프리로드 — manifest
// REGRESSION-FREEZE[bongsim-recommend-no-hard-refresh-spin]: fromCheckout는 클라 query(SSR 동적 params 금지) — manifest
// REGRESSION-FREEZE[bongsim-recommend-isr-cdn]: force-static + revalidate — CDN/cold spike 완화 — manifest

/** 요청 params 미사용 → private no-store 금지. bootstrap cache(120s)와 맞춤. */
export const dynamic = "force-static";
export const revalidate = 120;

export const metadata: Metadata = {
  title: "여행지별 eSIM 추천 | Bong투어 eSIM",
  description: "여행 국가를 고르면 일수·용량에 맞는 해외 eSIM을 추천해 드립니다.",
  alternates: { canonical: "/travel/esim/recommend" },
  openGraph: {
    title: "여행지별 eSIM 추천 | Bong투어 eSIM",
    description: "여행 국가를 고르면 일수·용량에 맞는 해외 eSIM을 추천해 드립니다.",
    url: "/travel/esim/recommend",
    type: "website",
  },
};

export default async function RecommendPage() {
  const bootstrap = await loadBongsimRecommendBootstrapCached();

  return (
    <RecommendPageClient
      initialCountries={bootstrap.ok ? bootstrap.data.countries : null}
      initialCatalogMeta={bootstrap.ok ? bootstrap.data.catalogMeta : null}
      initialHeroMap={bootstrap.ok ? bootstrap.data.heroMap : null}
      bootstrapError={bootstrap.ok ? null : bootstrap.reason}
    />
  );
}
