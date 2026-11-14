import type { Metadata } from "next";
import { buildEsimSearchMetadata, esimSearchTitle } from "@/lib/seo/esim-search-metadata";
import { EsimInstallGuideClient } from "./EsimInstallGuideClient";
import type { EsimGuideImageMap } from "@/lib/bongsim/esim-guide-content";
import { findImageAssetsByEntityType } from "@/lib/image-assets-db";

const ESIM_GUIDE_ENTITY_TYPE = "bongsim_esim_guide";

export const metadata: Metadata = {
  ...buildEsimSearchMetadata({
    title: esimSearchTitle("eSIM 설치 가이드"),
    description:
      "여행자님, eSIM(여행용) 발급부터 설치·활성화·삭제까지 iPhone·Android 경로별로 단계별 안내와 자주 묻는 질문을 확인해 보세요.",
    path: "/travel/esim/guide",
  }),
};

async function loadEsimGuideImageMap(): Promise<EsimGuideImageMap> {
  try {
    const rows = await findImageAssetsByEntityType(ESIM_GUIDE_ENTITY_TYPE);
    const map: EsimGuideImageMap = {};
    for (const row of rows) {
      const guideKey = row.entity_id.trim();
      const url = row.public_url.trim();
      if (!guideKey || !url || map[guideKey]) continue;
      map[guideKey] = {
        url,
        alt: row.alt_kr.trim() || row.title_kr?.trim() || "eSIM 설치 가이드",
        ...(row.width != null && row.width > 0 ? { width: row.width } : {}),
        ...(row.height != null && row.height > 0 ? { height: row.height } : {}),
      };
    }
    return map;
  } catch {
    return {};
  }
}

export default async function EsimInstallGuidePage() {
  const imageMap = await loadEsimGuideImageMap();
  return <EsimInstallGuideClient imageMap={imageMap} />;
}
