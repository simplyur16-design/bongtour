import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const ITEMS = [
  {
    n: '01',
    t: '공급사 일정·요금 기준',
    b: '하나투어·모두투어·노랑풍선·참좋은여행 등 등록 상품의 일정·포함 문구를 기준으로 보여 줍니다.',
  },
  {
    n: '02',
    t: '짧은 제목으로 먼저 고르기',
    b: '카드·히어로는 장소와 일수 위주로, 긴 공급사 상품명은 상세에서 확인합니다.',
  },
  {
    n: '03',
    t: '포함·불포함을 숨기지 않기',
    b: '상세에서 포함·불포함·예약 전 고지를 같은 화면에서 확인합니다.',
  },
  {
    n: '04',
    t: '상담·예약으로 이어짐',
    b: '선택 출발일 기준으로 상담·예약 요청을 남길 수 있습니다.',
  },
] as const

/** 홈 USP 요약 — docs/design/copy/home-section-bodies.ko.md `why_bongtour` */
export default function HomeWhyBongtourSection() {
  return (
    <section
      className="ow-live-why border-b border-bt-border-soft/50 py-10 sm:py-12"
      aria-labelledby="home-why-bongtour-heading"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <h2
          id="home-why-bongtour-heading"
          className="ow-live-section-title text-center text-xl tracking-tight sm:text-2xl"
        >
          왜 봉투어인가
        </h2>
        <ol className="mt-8 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8">
          {ITEMS.map((item) => (
            <li key={item.n} className="grid grid-cols-[auto_1fr] gap-3">
              <span className="ow-live-why-num text-lg" aria-hidden>
                {item.n}
              </span>
              <div>
                <strong className="block text-base font-bold text-[var(--bt-ow-ink-title)]">
                  {item.t}
                </strong>
                <p className="ow-live-section-body mt-1.5 text-sm">{item.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
