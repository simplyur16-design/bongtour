/** 상세 전환 — 서버 HTML 도착 전 체감용 (디자인 토큰: 라벤더 #EFEDF8) */
export default function ProductDetailPageSkeleton() {
  return (
    <div
      className="min-h-[72vh] animate-pulse bg-[#EFEDF8]"
      aria-hidden
      data-bt-detail-skeleton
    >
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="mb-6 h-8 max-w-md rounded-md bg-[#1F1B2D]/10" />
        <div className="mb-4 h-48 rounded-xl bg-[#1F1B2D]/8" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-[#1F1B2D]/6" />
          <div className="h-4 w-[92%] rounded bg-[#1F1B2D]/6" />
          <div className="h-4 w-[80%] rounded bg-[#1F1B2D]/6" />
        </div>
      </div>
    </div>
  )
}
