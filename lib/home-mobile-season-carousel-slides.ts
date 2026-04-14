import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'

/**
 * DB 슬롯이 5개 미만일 때만 채움 — **주요 서비스 메뉴와 동일한 루트를 반복하지 않는** 짧은 안내 카드.
 */
const CAROUSEL_CONTENT_FILLERS: HomeSeasonPickDTO[] = [
  {
    id: 'mobile-season-filler-hub',
    title: '이번 달 해외 허브에서 모아보기',
    excerpt: '출발 시기·예산을 기준으로 상품을 훑어보고, 맞는 루트는 상담에서 좁혀 가면 됩니다.',
    bodyFull:
      '출발 시기·예산을 기준으로 상품을 훑어보고, 맞는 루트는 상담에서 좁혀 가면 됩니다. 급한 일정은 문의 메모에 적어 주세요.',
    imageUrl: null,
    ctaHref: '/travel/overseas',
    ctaLabel: '해외 상품 둘러보기',
    monthKey: null,
    relatedCountryCode: null,
  },
  {
    id: 'mobile-season-filler-plan',
    title: '일정이 아직 느슨할 때',
    excerpt: '대략적인 지역만 정해져 있어도 됩니다. 동선 후보와 리스크 포인트를 짧게 정리해 드립니다.',
    bodyFull:
      '대략적인 지역만 정해져 있어도 됩니다. 동선 후보와 리스크 포인트를 짧게 정리해 드립니다. 확정 일정은 상담 이후 공급사 일정으로 맞춥니다.',
    imageUrl: null,
    ctaHref: '/inquiry?type=travel',
    ctaLabel: '상담 남기기',
    monthKey: null,
    relatedCountryCode: null,
  },
  {
    id: 'mobile-season-filler-read',
    title: '운영 브리핑과 함께 읽기',
    excerpt: '목적지별로 운영에서 올린 짧은 브리핑을 먼저 읽고 상품 카드와 비교해 보세요.',
    bodyFull:
      '목적지별로 운영에서 올린 짧은 브리핑을 먼저 읽고 상품 카드와 비교해 보세요. 시즌 추천 카드는 월별로 갱신됩니다.',
    imageUrl: null,
    ctaHref: '/travel/overseas',
    ctaLabel: '여행상품 허브로',
    monthKey: null,
    relatedCountryCode: null,
  },
  {
    id: 'mobile-season-filler-checklist',
    title: '출발 전에 체크할 것',
    excerpt: '비자·백신·환전·현지 이동 등은 상품마다 다릅니다. 상담 시 체크리스트로 짚어 드립니다.',
    bodyFull:
      '비자·백신·환전·현지 이동 등은 상품마다 다릅니다. 상담 시 체크리스트로 짚어 드립니다. 서류 마감이 있는 일정은 미리 알려 주세요.',
    imageUrl: null,
    ctaHref: '/inquiry?type=travel',
    ctaLabel: '문의하기',
    monthKey: null,
    relatedCountryCode: null,
  },
]

/** 항상 5슬롯 — DB에서 온 카드 우선, 부족분만 에디토리얼 슬롯으로 패딩. */
export function padHomeSeasonSlidesToFive(slides: HomeSeasonPickDTO[]): HomeSeasonPickDTO[] {
  const seen = new Set<string>()
  const out: HomeSeasonPickDTO[] = []
  for (const s of slides) {
    if (out.length >= 5) break
    if (seen.has(s.id)) continue
    seen.add(s.id)
    out.push({ ...s })
  }
  let fi = 0
  while (out.length < 5) {
    const base = CAROUSEL_CONTENT_FILLERS[fi % CAROUSEL_CONTENT_FILLERS.length]!
    out.push({ ...base, id: `${base.id}-pad-${out.length}` })
    fi += 1
  }
  return out.slice(0, 5)
}
