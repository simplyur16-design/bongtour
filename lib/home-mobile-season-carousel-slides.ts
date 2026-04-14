import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'

/** DB 시즌 픽 외 모바일 캐러셀용 고정 슬롯(운영 톤·실제 경로). */
const CAROUSEL_EXTRA: HomeSeasonPickDTO[] = [
  {
    id: 'mobile-hub-carousel-air-hotel',
    title: '항공+호텔 · 에어텔',
    excerpt: '항공과 숙소를 함께 맞추는 자유여행·에어텔 구성을 한눈에 살펴보세요.',
    bodyFull:
      '항공과 숙소를 함께 맞추는 자유여행·에어텔 구성을 한눈에 살펴보세요. 일정과 예산에 맞게 조합할 수 있습니다.',
    imageUrl: null,
    ctaHref: '/travel/air-hotel',
    ctaLabel: '항공+호텔 보기',
    monthKey: null,
  },
  {
    id: 'mobile-hub-carousel-private',
    title: '우리여행 · 맞춤 패키지',
    excerpt: '가족·지인 단위로 일정과 동선을 조정하는 소규모 맞춤 여행을 안내합니다.',
    bodyFull:
      '가족·지인 단위로 일정과 동선을 조정하는 소규모 맞춤 여행을 안내합니다. 상담을 통해 일정 초안을 함께 잡을 수 있습니다.',
    imageUrl: null,
    ctaHref: '/travel/overseas/private-trip',
    ctaLabel: '우리여행 알아보기',
    monthKey: null,
  },
  {
    id: 'mobile-hub-carousel-training',
    title: '국외연수 · 단체 출장',
    excerpt: '학교·기업·공공기관 단위 연수와 출장 일정을 검토할 때 참고해 보세요.',
    bodyFull:
      '학교·기업·공공기관 단위 연수와 출장 일정을 검토할 때 참고해 보세요. 인원과 목적에 맞는 코스를 상담으로 정리합니다.',
    imageUrl: null,
    ctaHref: '/training',
    ctaLabel: '국외연수 보기',
    monthKey: null,
  },
  {
    id: 'mobile-hub-carousel-inquiry',
    title: '여행 상담 접수',
    excerpt: '출발 시기와 예산을 알려 주시면 순차적으로 안내드립니다. 여행자보험 안내도 함께 드립니다.',
    bodyFull:
      '출발 시기와 예산을 알려 주시면 순차적으로 안내드립니다. 여행자보험 안내도 함께 드립니다. 급한 일정은 메모에 적어 주세요.',
    imageUrl: null,
    ctaHref: '/inquiry?type=travel',
    ctaLabel: '상담 남기기',
    monthKey: null,
  },
]

/** 항상 5슬롯 — 1번은 DB(또는 폴백) 시즌 픽, 나머지는 고정 카드로 채움. */
export function buildHomeMobileSeasonCarouselSlides(primary: HomeSeasonPickDTO): HomeSeasonPickDTO[] {
  const out: HomeSeasonPickDTO[] = [{ ...primary }]
  const primaryId = primary.id
  for (const row of CAROUSEL_EXTRA) {
    if (out.length >= 5) break
    if (row.id === primaryId) continue
    out.push({ ...row })
  }
  let i = 0
  while (out.length < 5) {
    const base = CAROUSEL_EXTRA[i % CAROUSEL_EXTRA.length]!
    out.push({ ...base, id: `${base.id}-pad-${out.length}` })
    i += 1
  }
  return out.slice(0, 5)
}
