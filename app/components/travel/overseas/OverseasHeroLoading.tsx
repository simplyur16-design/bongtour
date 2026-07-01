import { CINEMA_HERO_FRAME_CLASS } from '@/lib/cinema-hero-frame-class'
import { PulseBlock } from '@/components/route-loading/route-loading-primitives'

export default function OverseasHeroLoading() {
  return (
    <div className="border-b border-bt-border-soft bg-slate-100" aria-busy="true" aria-label="해외여행 검색 영역 불러오는 중">
      <PulseBlock className={`w-full ${CINEMA_HERO_FRAME_CLASS}`} />
    </div>
  )
}
