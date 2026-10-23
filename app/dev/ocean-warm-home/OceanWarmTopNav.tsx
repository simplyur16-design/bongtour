/** 라이브 Header MAIN_NAV와 동일 IA — 목업 전용 (서버 컴포넌트, draft-local) */
const NAV = [
  { label: '해외여행상품', short: '해외여행', href: '/travel/overseas' },
  { label: '자유여행', short: '자유여행', href: '/travel/air-hotel' },
  { label: 'eSIM', short: 'eSIM', href: '/travel/esim' },
  { label: '우리끼리', short: '우리끼리', href: '/travel/overseas/private-trip' },
  { label: '공공·기업', short: '공공·기업', href: '/business' },
] as const

/**
 * Ocean Warm 홈 목업 상단 — sticky 솔리드 바.
 * (클라이언트 스크롤 토글은 webpack chunk 이슈로 제외 — 메뉴 진입이 우선)
 */
export default function OceanWarmTopNav() {
  return (
    <header className="ow-top is-scrolled">
      <div className="ow-top-inner">
        <a className="ow-brand" href="#ow-top" aria-label="Bong투어">
          <span className="ow-brand-mark" aria-hidden />
          <span className="ow-brand-word">Bong투어</span>
        </a>
        <nav className="ow-nav" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              <span className="ow-nav-full">{item.label}</span>
              <span className="ow-nav-short">{item.short}</span>
            </a>
          ))}
        </nav>
        <div className="ow-top-actions">
          <a className="ow-nav-ghost" href="/dev/product-surface-preview">
            상품 상세
          </a>
          <a
            className="ow-nav-ghost"
            href="/admin/similar-itinerary-compare?place=상해&duration=3박%204일"
          >
            비교 운영
          </a>
          <a className="ow-nav-cta" href="/inquiry?type=travel">
            상담
          </a>
        </div>
      </div>
    </header>
  )
}
