import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const ITEMS = [
  {
    n: '01',
    t: '대한민국 대표 여행사 상품을 한곳에서 비교',
    b: '하나투어, 모두투어, 노랑풍선, 참좋은여행 등 검증된 국내 대표 여행사들의 상품을 한눈에 모아 보여드립니다. 복잡한 검색 없이 핵심 일정과 포함 내역을 기준으로 고객님께 가장 적합한 여행을 효율적으로 찾아드립니다.',
  },
  {
    n: '02',
    t: '직관적이고 군더더기 없는 스마트한 탐색',
    b: "복잡하고 긴 공급사 상품명에 피로감을 느끼지 않으시도록, 여행의 핵심인 '목적지'와 '일정'을 직관적인 카드 형태로 먼저 제시합니다. 고객님이 원하는 여행의 본질에 빠르게 다가갈 수 있는 사용자 중심의 인터페이스를 제공합니다.",
  },
  {
    n: '03',
    t: "숨김없이 투명한 '원페이지' 상세 정보",
    b: '여행의 만족은 투명함에서 시작됩니다. 상품의 포함 및 불포함 내역, 예약 전 필수 고지사항 등 놓치기 쉬운 중요 정보들을 페이지 이동 없이 단일 화면에서 명확하게 제공하여 안전하고 신뢰할 수 있는 선택을 돕습니다.',
  },
  {
    n: '04',
    t: '내 일정에 맞춘 다이렉트 맞춤 상담',
    b: '선택 가능한 출발일과 표시된 요금을 기준으로 상담·예약 요청을 남기실 수 있습니다. 복잡한 절차 없이, 고객님 일정에 맞춰 안내해 드립니다.',
  },
] as const

/** 홈 USP — docs/design/copy/home-section-bodies.ko.md `why_bongtour` */
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
                <strong className="ow-live-why-title">
                  {item.t}
                </strong>
                <p className="ow-live-section-body mt-1.5 text-sm leading-relaxed">{item.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
