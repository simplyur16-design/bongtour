import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import TopMegaMenu from '@/components/top-nav/TopMegaMenu'

/** 해외여행 허브 — 권역·국가 메가메뉴만 (3탭 서브네비 없음, 헤더 4메뉴와 중복 방지). */
export default function OverseasRegionMegaNav() {
  return (
    <div
      className="hidden border-y border-bt-border-soft bg-slate-50 shadow-sm lg:block"
      aria-label="해외여행 지역 탐색"
    >
      <div className={`${SITE_CONTENT_CLASS} py-2`}>
        <TopMegaMenu />
      </div>
    </div>
  )
}
