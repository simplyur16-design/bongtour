import TripRecommendationsClient from '@/components/admin/marketing/trip-recommendations/TripRecommendationsClient'

export const dynamic = 'force-dynamic'

export default function TripRecommendationsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">콘텐츠 자동화</h1>
        <p className="mt-1 text-sm text-bt-body/70">
          봉투어 활성 상품 기반 추천 → 카드뉴스 또는 블로그 자동 생성
        </p>
      </div>
      <TripRecommendationsClient />
    </div>
  )
}
