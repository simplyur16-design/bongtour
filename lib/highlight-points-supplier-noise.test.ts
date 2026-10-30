import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  classifyHighlightNoiseLine,
  filterHighlightPointsSupplierNoise,
  HIGHLIGHT_LINE_TEXT_CLASS,
  resolveHighlightPointsForDisplay,
  sanitizeHighlightPointsText,
} from '@/lib/highlight-points-supplier-noise'

// fit-hn-0048 라이브 '상품 핵심 포인트' 꼬리(하나투어 SAFETY&JOY 블록 + 프로모션 URL)
const FIT_HN_0048_TAIL = [
  '난젠지 · 수로각 · 우메코지공원에서 만나는 교토의 정취',
  '린쿠 프리미엄 아울렛 쇼핑',
  '객실 변경이 어려운 경우 2인실+싱글룸으로 배정되며, 싱글룸 이용 추가요금이 발생합니다.',
  '온전히 여행에 집중하는 하나투어의 대표여행상품입니다.',
  '쾌적한 객실과 힐튼 브랜드의 편안한 서비스',
  '현지투어 또는 유사 상품과 공동행사로 진행될 수 있습니다.',
  'SAFETY&JOY 하나투어는 여행의 전 과정을 함께 합니다.',
  '① 안심여행의 시작, 100% 보상 프로그램',
  '여행 중 24시간 긴급 의료 지원 등 H-care',
  '여행 후에도 이어지는 고객 만족 서비스',
  'https://www.hanatour.com/promotion/plan/PM0000113771',
].join('\n')

describe('highlight-points-supplier-noise', () => {
  it('fit-hn-0048: drops hanatour SAFETY&JOY / 100% 보상 / H-care / promo URL / 대표상품 brand line; keeps content and price-ish notes verbatim', () => {
    const r = filterHighlightPointsSupplierNoise(FIT_HN_0048_TAIL)
    const out = r.text ?? ''
    for (const bad of ['SAFETY', '100% 보상', 'H-care', 'hanatour.com', 'http', '하나투어', '고객 만족 서비스']) {
      expect(out).not.toContain(bad)
    }
    expect(out.split('\n')).toEqual([
      '난젠지 · 수로각 · 우메코지공원에서 만나는 교토의 정취',
      '린쿠 프리미엄 아울렛 쇼핑',
      '객실 변경이 어려운 경우 2인실+싱글룸으로 배정되며, 싱글룸 이용 추가요금이 발생합니다.',
      '쾌적한 객실과 힐튼 브랜드의 편안한 서비스',
      '현지투어 또는 유사 상품과 공동행사로 진행될 수 있습니다.',
    ])
    expect(r.removed.map((x) => x.reason)).toEqual(
      expect.arrayContaining(['brand_promo', 'program', 'program_block']),
    )
  })

  it('hanatour 세심한 배려(양우산) block is removed until the next content header', () => {
    const t = [
      '🌅 알바호텔 이토시마 (Alba Hotel&Glamping)',
      '하나투어 고객만을 위한 세심한 배려 💟',
      '☂️양우산 대여 서비스🌂',
      '햇살은 가리고 짐은 가볍게!',
      '투어 중엔 시원한 그늘이 되어드리고, 투어 후엔 가볍게 반납하시면 됩니다.😊',
      '✅ 상품 핵심포인트 안내',
      '유후인 & 벳부 관광',
    ].join('\n')
    expect(sanitizeHighlightPointsText(t)!.split('\n')).toEqual([
      '🌅 알바호텔 이토시마 (Alba Hotel&Glamping)',
      '✅ 상품 핵심포인트 안내',
      '유후인 & 벳부 관광',
    ])
  })

  it('generalizes per supplier: brand + self-promo cue lines removed for all 7 suppliers; plain brand-free lines kept', () => {
    const lines = [
      '노랑풍선 단독 특가 상품',
      '롯데관광 고객님께만 드리는 혜택',
      '참좋은여행과 함께하는 안심 여행',
      '모두투어가 엄선한 호텔',
      '내일투어 회원 전용 혜택',
      '교원투어 여행이지 단독 구성',
      '하나투어 고객만을 위한 전용 서비스',
    ]
    for (const l of lines) expect(classifyHighlightNoiseLine(l)).toBe('brand_promo')
    expect(classifyHighlightNoiseLine('전 일정 5성급 호텔 투숙으로 보장하는 편안한 휴식')).toBeNull()
    expect(classifyHighlightNoiseLine('7성급 엠파이어 호텔 3박 투숙과 데일리 미니바 무료 제공')).toBeNull()
  })

  it('any http(s)/www/domain URL: URL-only lines dropped, URL fragment stripped from content lines (rest verbatim)', () => {
    const t = [
      '자세히 보기: https://www.ybtour.co.kr/promotion/abc',
      'www.modetour.com/event/123',
      '오사카성 관광 (안내: https://example.com/x) 포함',
      '가격 1,290,000원 그대로',
    ].join('\n')
    const r = filterHighlightPointsSupplierNoise(t)
    expect(r.text!.split('\n')).toEqual(['오사카성 관광 (안내: ) 포함', '가격 1,290,000원 그대로'])
    expect(r.urlStripped).toBe(1)
  })

  it('duplicate section heading line and supplier phone / 기획전 lines are removed; all-noise → null', () => {
    expect(sanitizeHighlightPointsText('✅ 상품 핵심포인트\n대표번호 1577-1233\n기획전 바로가기')).toBeNull()
    expect(sanitizeHighlightPointsText(null)).toBeNull()
    expect(sanitizeHighlightPointsText('   ')).toBeNull()
  })

  it('display: long unbroken text wraps (break-words + overflow-wrap:anywhere); URL/promo lines not shown; raw fallback filtered; all-noise hidden', () => {
    expect(HIGHLIGHT_LINE_TEXT_CLASS).toContain('break-words')
    expect(HIGHLIGHT_LINE_TEXT_CLASS).toContain('[overflow-wrap:anywhere]')
    expect(HIGHLIGHT_LINE_TEXT_CLASS).toContain('min-w-0')
    const src = readFileSync('app/components/detail/ProductHighlightPointsSection.tsx', 'utf8')
    expect(src).toContain('className={HIGHLIGHT_LINE_TEXT_CLASS}')
    expect(src).toContain('resolveHighlightPointsForDisplay(')
    const shown = resolveHighlightPointsForDisplay(FIT_HN_0048_TAIL, null)!
    expect(shown).not.toMatch(/hanatour\.com|SAFETY|H-care/)
    expect(shown).toContain('린쿠 프리미엄 아울렛 쇼핑')
    // 큐레이션이 전부 노이즈면 원문 필터본으로
    expect(resolveHighlightPointsForDisplay('https://www.hanatour.com/promotion/plan/PM1', FIT_HN_0048_TAIL)).toContain('린쿠')
    expect(resolveHighlightPointsForDisplay(null, FIT_HN_0048_TAIL)).not.toContain('100% 보상')
    expect(resolveHighlightPointsForDisplay('https://www.hanatour.com/promotion/plan/PM1', null)).toBeNull()
  })

  it('register/heal path: shared self-heal (runs after every 7-supplier confirm + pending cron) sanitizes highlightPoints for non-registered; raw untouched', () => {
    const src = readFileSync('lib/register-pending-pre-photo-self-heal.ts', 'utf8')
    expect(src).toContain("import { sanitizeHighlightPointsText } from '@/lib/highlight-points-supplier-noise'")
    expect(src).toMatch(/currentStatus !== 'registered' && highlightBefore\?\.trim\(\)\s*\?\s*sanitizeHighlightPointsText\(highlightBefore\)/)
    expect(src).toContain("'highlight_supplier_noise'")
    expect(src).not.toMatch(/data\.highlightPointsRaw\s*=/)
    const after = readFileSync('lib/register-confirm-after-save.ts', 'utf8')
    expect(after).toContain('applyRegisterPrePhotoQueueGateAfterSave(id)')
  })
})
