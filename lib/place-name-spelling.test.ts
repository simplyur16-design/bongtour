import { describe, expect, it } from 'vitest'
import {
  PLACE_NAME_SPELLING_DICTIONARY,
  PLACE_NAME_SPELLING_PROMPT_RULE,
  buildPlaceNameSpellingReview,
  detectPlaceNameSpellingFlags,
  mergePlaceNameSpellingReviewIntoRawMeta,
  normalizePlaceNameSpelling,
  normalizePlaceNameSpellingText,
  parsePlaceNameSpellingReviewFromRawMeta,
  postCheckGeneratedPlaceNames,
} from '@/lib/place-name-spelling'

/** REGRESSION-FREEZE[place-name-spelling-n1]: certain 사전만 교정, 불확실은 플래그 — manifest */
describe('place-name-spelling dictionary', () => {
  it('every entry has a source and certain variants never equal standard', () => {
    for (const e of PLACE_NAME_SPELLING_DICTIONARY) {
      expect(e.source, e.variant).toBeTruthy()
      expect(e.variant).not.toBe(e.standard)
    }
  })
  it('policy names are never certain (나트랑·푸켓·호치민·시엠립)', () => {
    for (const v of ['나트랑', '푸켓', '호치민', '시엠립']) {
      const e = PLACE_NAME_SPELLING_DICTIONARY.find((x) => x.variant === v)
      expect(e?.confidence, v).toBe('uncertain')
    }
  })
})

describe('normalizePlaceNameSpelling', () => {
  it('N1 example 푸꼽옥 → 푸꾸옥, 푸꾸욱자유여행 tag', () => {
    expect(normalizePlaceNameSpellingText('[노보텔 푸꼽옥]')).toBe('[노보텔 푸꾸옥]')
    expect(normalizePlaceNameSpellingText('푸꾸욱자유여행. 자유여행')).toBe('푸꾸옥자유여행. 자유여행')
  })
  it('Japanese tense consonant / ㅊ→ㅆ rules', () => {
    expect(normalizePlaceNameSpellingText('북큐슈 기타큐슈 큐슈')).toBe('북규슈 기타큐슈 규슈')
    expect(normalizePlaceNameSpellingText('마츠야마성 다카마츠 벳부 온천')).toBe('마쓰야마성 다카마쓰 벳푸 온천')
  })
  it('터키 guard: 튀르키예(터키)·터키항공 untouched, standalone fixed', () => {
    expect(normalizePlaceNameSpellingText('튀르키예(터키) 터키항공 터키 일주')).toBe('튀르키예(터키) 터키항공 튀르키예 일주')
  })
  it('typos: 효도협·하와리·도톰보리', () => {
    expect(normalizePlaceNameSpellingText('효도협 트레킹')).toBe('호도협 트레킹')
    expect(normalizePlaceNameSpellingText('하와리')).toBe('하와이')
    expect(normalizePlaceNameSpellingText('도톰보리')).toBe('도톤보리')
  })
  it('uncertain/policy names stay as-is', () => {
    const s = '나트랑 푸켓 호치민 혼똠섬 테렐지 츠카사'
    expect(normalizePlaceNameSpelling(s).text).toBe(s)
  })
  it('hanja-reading names allowed (외래어 표기법 4장 2절 4항)', () => {
    const s = '동경 상해 북경 장가계 북해도'
    expect(normalizePlaceNameSpellingText(s)).toBe(s)
  })
  it('no-op returns identical value; non-string passthrough; digits/prices untouched', () => {
    const s = '벳부 2박3일 1,290,000원'
    expect(normalizePlaceNameSpellingText(s)).toBe('벳푸 2박3일 1,290,000원')
    expect(normalizePlaceNameSpellingText(null)).toBeNull()
    expect(normalizePlaceNameSpellingText(123 as unknown)).toBe(123)
  })
  it('idempotent', () => {
    const once = normalizePlaceNameSpellingText('벳부 큐슈 비엔티엔 울란바타르')
    expect(normalizePlaceNameSpellingText(once)).toBe(once)
  })
})

describe('flags', () => {
  it('policy, uncertain, suspicious, mixed', () => {
    const f = detectPlaceNameSpellingFlags(['나트랑 혼똠섬 푸꾸웍 샤먼 하문'])
    const types = f.map((x) => x.type)
    expect(types).toContain('dictionary_uncertain')
    expect(types).toContain('suspicious_name')
    expect(types).toContain('mixed_spelling')
    expect(f.some((x) => x.type === 'dictionary_uncertain' && x.policy)).toBe(true)
  })
  it('common words not flagged', () => {
    expect(detectPlaceNameSpellingFlags(['시그니처 굿바이 스트리트 프라자']).filter((x) => x.type === 'suspicious_name')).toEqual([])
  })
})

describe('post-check + prompt', () => {
  it('prompt rule forbids invented names and price edits', () => {
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/만들거나 추측/)
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/가격|금액/)
  })
  it('postCheckGeneratedPlaceNames fixes certain + reports flags', () => {
    const r = postCheckGeneratedPlaceNames('벳부 지옥온천, 나트랑 해변')
    expect(r.text).toBe('벳푸 지옥온천, 나트랑 해변')
    expect(r.flags.length).toBeGreaterThan(0)
  })
})

describe('rawMeta review', () => {
  it('deterministic merge, unchanged when equal, removed when null', () => {
    const review = buildPlaceNameSpellingReview({ title: '벳부 온천', summary: '나트랑' })
    expect(review?.autoDisplayFixes[0]).toMatchObject({ field: 'title', variant: '벳부', standard: '벳푸' })
    const base = JSON.stringify({ a: 1 })
    const m1 = mergePlaceNameSpellingReviewIntoRawMeta(base, review)
    expect(mergePlaceNameSpellingReviewIntoRawMeta(m1, buildPlaceNameSpellingReview({ title: '벳부 온천', summary: '나트랑' }))).toBe(m1)
    expect(parsePlaceNameSpellingReviewFromRawMeta(m1)?.version).toBe('n1-v1')
    expect(JSON.parse(m1).a).toBe(1)
    const cleared = mergePlaceNameSpellingReviewIntoRawMeta(m1, null)
    expect(JSON.parse(cleared).placeNameSpellingReview).toBeUndefined()
    expect(buildPlaceNameSpellingReview({ title: '오사카 3일' })).toBeNull()
    expect(mergePlaceNameSpellingReviewIntoRawMeta(base, null)).toBe(base)
  })
})
