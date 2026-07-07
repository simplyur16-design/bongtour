import { notFound } from "next/navigation";
import { SimplyurRecommendClient } from "./SimplyurRecommendClient";
import { isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { loadSimplyurKoreaCatalogCached } from "@/lib/simplyur/catalog/load-korea-catalog-cached";

type Props = { params: Promise<{ locale: string }> };

// REGRESSION-FREEZE[simplyur-catalog-server-fetch-p0]: recommend 서버 프리로드 — manifest

export default async function SimplyurRecommendPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) notFound();
  const locale = raw as SimplyurLocale;

  const catalog = await loadSimplyurKoreaCatalogCached(locale);

  return (
    <SimplyurRecommendClient
      initialPack={catalog.ok ? catalog.pack : null}
      initialError={catalog.ok ? null : catalog.reason}
    />
  );
}
