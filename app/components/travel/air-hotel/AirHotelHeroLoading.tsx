import { PulseBlock } from '@/components/route-loading/route-loading-primitives'

export default function AirHotelHeroLoading() {
  return (
    <div
      className="border-b border-bt-border-soft bg-slate-100"
      aria-busy="true"
      aria-label="자유여행 시즌 영역 불러오는 중"
    >
      <PulseBlock className="mx-auto h-[min(18rem,48vh)] w-full max-w-6xl sm:h-56" />
    </div>
  )
}
