import type { HomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import type { HomeHubTravelCardCoverPick } from '@/lib/home-hub-travel-card-cover'

type CardKey = 'overseas' | 'domestic'

function classifyDomestic(
  detail: HomeHubCardHybridResolutionDetail,
  poolPick: HomeHubTravelCardCoverPick | null,
): string {
  if (detail.tier === 'manual') {
    return 'manual override — JSON 수동 URL이 우선이라 product_pool 픽은 화면에 반영되지 않음'
  }
  if (detail.tier === 'fallback') {
    return 'fallback — 풀·수동 모두 없어 정적 이미지'
  }
  if (detail.tier !== 'product_pool') {
    return `기타 티어: ${detail.tier}`
  }
  if (!poolPick) {
    return '비정상: product_pool 티어인데 풀 픽 메타 없음'
  }
  if ((poolPick.travelScope ?? '').trim() !== 'domestic') {
    return '매핑/데이터 버그 가능: domestic 풀 픽인데 travelScope !== domestic'
  }
  return 'domestic 상품 확정 — 화면은 해당 상품의 bgImageUrl/일정 기반 커버(시각이 해외처럼 보이면 상품·일정 이미지 품질)'
}

function classifyOverseas(
  detail: HomeHubCardHybridResolutionDetail,
  poolPick: HomeHubTravelCardCoverPick | null,
): string {
  if (detail.tier === 'manual') {
    return 'manual override — product_pool 픽은 화면에 반영되지 않음'
  }
  if (detail.tier === 'fallback') {
    return 'fallback — 정적 이미지'
  }
  if (detail.tier !== 'product_pool') {
    return `기타 티어: ${detail.tier}`
  }
  if (!poolPick) {
    return '비정상: product_pool 티어인데 풀 픽 메타 없음'
  }
  if ((poolPick.travelScope ?? '').trim() !== 'overseas') {
    return '매핑/데이터 버그 가능: overseas 풀 픽인데 travelScope !== overseas'
  }
  return 'overseas 상품 확정'
}

function block(
  cardKey: CardKey,
  detail: HomeHubCardHybridResolutionDetail,
  poolPick: HomeHubTravelCardCoverPick | null,
  classify: (d: HomeHubCardHybridResolutionDetail, p: HomeHubTravelCardCoverPick | null) => string,
) {
  return {
    cardKey,
    imageSourceTier: detail.tier,
    finalImageSrc: detail.url,
    productPoolPick: poolPick
      ? {
          productId: poolPick.productId,
          title: poolPick.title,
          travelScope: poolPick.travelScope,
          originSource: poolPick.originSource,
          bgImageUrl: poolPick.bgImageUrl,
          poolCoverUrl: poolPick.imageSrc,
          scheduleImageSummary: poolPick.scheduleImageSummary,
        }
      : null,
    hybridExplanation: detail.explanationShort,
    causeClassification: classify(detail, poolPick),
  }
}

type Props = {
  overseasPick: HomeHubTravelCardCoverPick | null
  domesticPick: HomeHubTravelCardCoverPick | null
  overseasDetail: HomeHubCardHybridResolutionDetail
  domesticDetail: HomeHubCardHybridResolutionDetail
}

/**
 * `next dev` 전용 — 메인 허브 해외/국내 카드의 실제 티어·풀 픽·최종 URL을 한 번에 본다.
 * 프로덕션 빌드에는 포함되지 않음.
 */
export function HomeHubCardDebugServerPanel({ overseasPick, domesticPick, overseasDetail, domesticDetail }: Props) {
  if (process.env.NODE_ENV === 'production') return null

  const payload = {
    overseas: block('overseas', overseasDetail, overseasPick, classifyOverseas),
    domestic: block('domestic', domesticDetail, domesticPick, classifyDomestic),
  }

  return (
    <div className="mx-auto max-w-6xl px-3 pb-6 sm:px-5">
      <details className="rounded-lg border border-amber-700/50 bg-amber-50/95 text-left text-slate-900 shadow-sm">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-amber-950">
          [dev] 메인 허브 카드 — 실제 선택 결과 (해외·국내)
        </summary>
        <pre className="max-h-[70vh] overflow-auto border-t border-amber-800/30 p-3 text-[10px] leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  )
}
