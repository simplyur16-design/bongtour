import type { Metadata } from 'next'
import { assertDevDesignPreviewAllowed } from '@/lib/dev-design-preview-guard'
import { homeHubCardImageSrc } from '@/lib/home-hub-images'
import OceanWarmAirHotelCards from './OceanWarmAirHotelCards'
import OceanWarmTopNav from './OceanWarmTopNav'
import './ocean-warm-home.css'

export const metadata: Metadata = {
  title: 'Ocean Warm Home mock · draft-local',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/** 목업 전용 — 라이브 hub overseas 이미지와 다른 가족·소그룹 컷 */
const PRIVATE_TRIP_ENTRY_IMG =
  'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=1200'

const DEST = [
  {
    lab: '동남아',
    img: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    lab: '일본',
    img: 'https://images.pexels.com/photos/402028/pexels-photo-402028.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    lab: '유럽',
    img: 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    lab: '미주',
    img: 'https://images.pexels.com/photos/290386/pexels-photo-290386.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    lab: '중국',
    img: 'https://images.pexels.com/photos/2412603/pexels-photo-2412603.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    lab: '중남미',
    img: 'https://images.pexels.com/photos/2356045/pexels-photo-2356045.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    lab: '아프리카',
    img: 'https://images.pexels.com/photos/33045/lion-wild-africa-african.jpg?auto=compress&cs=tinysrgb&w=600',
  },
] as const

const CARDS = [
  {
    t: '다낭 5일',
    s: '베트남',
    p: '899,000원~',
    img: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    t: '동유럽 10일',
    s: '프라하 · 부다페스트',
    p: '2,490,000원~',
    img: 'https://images.pexels.com/photos/2346216/pexels-photo-2346216.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    t: '오키나와 4일',
    s: '일본',
    p: '1,120,000원~',
    img: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
] as const

/**
 * Ocean Warm Editorial 홈 목업 — draft-local.
 * 첫 뷰포트: 브랜드 + 시즌 비주얼 + 헤드 + 서포트 + CTA.
 * 상단: 라이브 MAIN_NAV와 같은 허브 진입 (스크롤만으로 찾지 않게).
 */
export default function OceanWarmHomeMockPage() {
  assertDevDesignPreviewAllowed()

  return (
    <div className="ow-home" id="ow-top">
      <a className="ow-skip" href="#ow-main">
        본문으로
      </a>

      <OceanWarmTopNav />

      <section className="ow-hero" aria-label="시즌 히어로">
        <div className="ow-hero-media" role="img" aria-label="시즌 여행지 풍경" />
        <div className="ow-hero-scrim" />
        <div className="ow-hero-copy">
          <p className="ow-hero-brand">Bong투어</p>
          <h1>지금 떠날 해외여행</h1>
          <p className="ow-hero-support">
            시즌별로 모아 둔 패키지·자유여행입니다. 가격과 출발일은 상품 상세에서 확인하세요.
          </p>
          <div className="ow-cta-row">
            <a className="ow-btn-primary" href="#season">
              시즌 여행 보기
            </a>
            <a className="ow-btn-warm" href="/inquiry?type=travel">
              상담하기
            </a>
          </div>
          <div className="ow-dots" aria-hidden>
            <span className="is-on" />
            <span />
            <span />
          </div>
        </div>
      </section>

      <main id="ow-main">
        <section className="ow-section" id="dest">
          <h2>목적지로 고르기</h2>
          <ul className="ow-dest-row">
            {DEST.map((d) => (
              <li key={d.lab}>
                <a
                  className="ow-dest"
                  href="/travel/overseas"
                  style={{ backgroundImage: `url(${d.img})` }}
                >
                  <span>{d.lab}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="ow-section" id="season">
          <h2>이번 달 추천상품</h2>
          <ul className="ow-cards">
            {CARDS.map((c) => (
              <li key={c.t}>
                <a className="ow-card" href="/dev/product-surface-preview">
                  <div
                    className="ow-card-media"
                    style={{ backgroundImage: `url(${c.img})` }}
                    role="img"
                    aria-label={c.t}
                  />
                  <div className="ow-card-meta">
                    <strong>{c.t}</strong>
                    <span>{c.s}</span>
                    <em>{c.p}</em>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="ow-section ow-usp" id="why">
          <h2>왜 봉투어인가</h2>
          <ol>
            <li>
              <span className="ow-num" aria-hidden>
                01
              </span>
              <div>
                <strong>대한민국 대표 여행사 상품을 한곳에서 비교</strong>
                <p>
                  하나투어, 모두투어, 노랑풍선, 참좋은여행 등 검증된 국내 대표 여행사들의 상품을 한눈에
                  모아 보여드립니다. 복잡한 검색 없이 핵심 일정과 포함 내역을 기준으로 고객님께 가장
                  적합한 여행을 효율적으로 찾아드립니다.
                </p>
              </div>
            </li>
            <li>
              <span className="ow-num" aria-hidden>
                02
              </span>
              <div>
                <strong>직관적이고 군더더기 없는 스마트한 탐색</strong>
                <p>
                  복잡하고 긴 공급사 상품명에 피로감을 느끼지 않으시도록, 여행의 핵심인 &apos;목적지&apos;와
                  &apos;일정&apos;을 직관적인 카드 형태로 먼저 제시합니다. 고객님이 원하는 여행의 본질에
                  빠르게 다가갈 수 있는 사용자 중심의 인터페이스를 제공합니다.
                </p>
              </div>
            </li>
            <li>
              <span className="ow-num" aria-hidden>
                03
              </span>
              <div>
                <strong>숨김없이 투명한 &apos;원페이지&apos; 상세 정보</strong>
                <p>
                  여행의 만족은 투명함에서 시작됩니다. 상품의 포함 및 불포함 내역, 예약 전 필수
                  고지사항 등 놓치기 쉬운 중요 정보들을 페이지 이동 없이 단일 화면에서 명확하게
                  제공하여 안전하고 신뢰할 수 있는 선택을 돕습니다.
                </p>
              </div>
            </li>
            <li>
              <span className="ow-num" aria-hidden>
                04
              </span>
              <div>
                <strong>내 일정에 맞춘 다이렉트 맞춤 상담</strong>
                <p>
                  고객님이 원하시는 정확한 출발일을 기준으로 빠르고 간편하게 상담 및 예약 요청을
                  남기실 수 있습니다. 복잡한 절차를 생략하고, 고객의 일정에 맞춘 최적의 여행 솔루션을
                  신속하게 안내해 드립니다.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="ow-esim" id="esim" aria-label="eSIM">
          <div className="ow-esim-inner">
            <h2>여행지 데이터, eSIM으로</h2>
            <p>
              출국 전 설치·개통 안내와 요금제를 한곳에서 고릅니다. 패키지 예약과 결제 흐름은 분리되어
              있습니다.
            </p>
            <a className="ow-btn-esim" href="/travel/esim">
              eSIM 요금제
            </a>
          </div>
        </section>

        <section className="ow-section" id="air">
          <h2>항공과 호텔만 필요할 때</h2>
          <p className="ow-body">
            국내 유명 여행사에서 검증된 호텔과 저렴한 항공권으로 가는 자유여행
          </p>
          <OceanWarmAirHotelCards />
        </section>

        <section className="ow-section" id="trust">
          <h2>우리끼리 여행</h2>
          <p className="ow-body">
            다른 팀 일정에 맞출 필요 없이, 우리 일행의 속도와 분위기에 맞춰 상담합니다.
          </p>
          <a
            className="ow-entry"
            href="/travel/overseas/private-trip"
            style={{ backgroundImage: `url(${PRIVATE_TRIP_ENTRY_IMG})` }}
          >
            <span className="ow-entry-kicker">우리끼리</span>
            <strong>가족·소그룹 단독 진행</strong>
            <span className="ow-entry-cta">문의하기</span>
          </a>
        </section>

        <section className="ow-section ow-section-last" id="counsel">
          <h2>단체·기관 맞춤</h2>
          <p className="ow-body">
            정부·공공·기업 목적의 연수·전세버스·발권·통역은 상담 후 안내합니다.
          </p>
          <a
            className="ow-entry"
            href="/business"
            style={{ backgroundImage: `url(${homeHubCardImageSrc('training', 'webp')})` }}
          >
            <span className="ow-entry-kicker">공공·기업</span>
            <strong>연수·전세버스·발권</strong>
            <span className="ow-entry-cta">견적의뢰하기</span>
          </a>
        </section>
      </main>

      <div className="ow-sticky" role="group" aria-label="빠른 연락">
        <a className="ow-sticky-warm" href="/inquiry?type=travel">
          상담
        </a>
        <a className="ow-sticky-kakao" href="#kakao">
          카톡
        </a>
        <a className="ow-sticky-call" href="tel:0312132558">
          전화
        </a>
      </div>
    </div>
  )
}
