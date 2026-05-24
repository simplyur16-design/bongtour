import type { HomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import type { HomeHubTravelCardCoverPick } from '@/lib/home-hub-travel-card-cover'

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

type Props = {
  overseasPick: HomeHubTravelCardCoverPick | null
  overseasDetail: HomeHubCardHybridResolutionDetail
}

/**
 * `next dev` 전용 — 메인 허브 해외 카드의 실제 티어·풀 픽·최종 URL.
 * 프로덕션 빌드에는 포함되지 않음.
 */
export function HomeHubCardDebugServerPanel({ overseasPick, overseasDetail }: Props) {
  if (process.env.NODE_ENV === 'production') return null

  const payload = {
    overseas: {
      cardKey: 'overseas' as const,
      imageSourceTier: overseasDetail.tier,
      finalImageSrc: overseasDetail.url,
      productPoolPick: overseasPick
        ? {
            productId: overseasPick.productId,
            title: overseasPick.title,
            travelScope: overseasPick.travelScope,
            originSource: overseasPick.originSource,
            bgImageUrl: overseasPick.bgImageUrl,
            poolCoverUrl: overseasPick.imageSrc,
            scheduleImageSummary: overseasPick.scheduleImageSummary,
          }
        : null,
      hybridExplanation: overseasDetail.explanationShort,
      causeClassification: classifyOverseas(overseasDetail, overseasPick),
    },
  }

  return (
    <div className="mx-auto max-w-6xl px-3 pb-6 sm:px-5">
      <details className="rounded-lg border border-amber-700/50 bg-amber-50/95 text-left text-slate-900 shadow-sm">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-amber-950">
          [dev] 메인 허브 카드 — 해외 실제 선택 결과
        </summary>
        <pre className="max-h-[28rem] overflow-auto p-3 text-[11px] leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  )
}
