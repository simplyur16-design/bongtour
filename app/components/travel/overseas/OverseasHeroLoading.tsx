import { PulseBlock } from '@/components/route-loading/route-loading-primitives'

export default function OverseasHeroLoading() {
  return (
    <div className="border-b border-bt-border-soft bg-slate-100" aria-busy="true" aria-label="해외여행 검색 영역 불러오는 중">
      <PulseBlock className="mx-auto h-[min(22rem,58vh)] w-full max-w-6xl sm:h-64" />
    </div>
  )
}
