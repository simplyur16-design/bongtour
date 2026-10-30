import { describe, expect, it } from 'vitest'
import {
  PLACE_NAME_COMMON_VS_STANDARD,
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
  it('owner 23:44: common names are the standard — never a dictionary variant', () => {
    for (const v of ['나트랑', '푸켓', '호치민', '씨엠립', '크라비']) {
      expect(PLACE_NAME_SPELLING_DICTIONARY.find((x) => x.variant === v), v).toBeUndefined()
    }
    for (const bad of ['냐짱', '푸껫', '호찌민', '시엠레아프']) {
      expect(PLACE_NAME_SPELLING_DICTIONARY.some((x) => x.standard === bad), bad).toBe(false)
    }
  })
  it('common-vs-standard pairs are not auto-fixed nor flagged', () => {
    for (const [a, b] of PLACE_NAME_COMMON_VS_STANDARD) {
      expect(PLACE_NAME_SPELLING_DICTIONARY.some((x) => x.variant === a && x.confidence === 'certain'), a).toBe(false)
      expect(normalizePlaceNameSpellingText(a)).toBe(a)
      expect(normalizePlaceNameSpellingText(b)).toBe(b)
      expect(detectPlaceNameSpellingFlags([a]).filter((f) => f.type !== 'mixed_spelling'), a).toEqual([])
    }
  })
})

describe('normalizePlaceNameSpelling', () => {
  it('N1 example 푸꼽옥 → 푸꾸옥, 푸꾸욱자유여행 tag', () => {
    expect(normalizePlaceNameSpellingText('[노보텔 푸꼽옥]')).toBe('[노보텔 푸꾸옥]')
    expect(normalizePlaceNameSpellingText('푸꾸욱자유여행. 자유여행')).toBe('푸꾸옥자유여행. 자유여행')
  })
  it('owner 23:44: 냐짱→나트랑, 푸껫/푸께/푸껓/푸껑→푸켓, 호찌민→호치민', () => {
    expect(normalizePlaceNameSpellingText('냐짱 빈펄')).toBe('나트랑 빈펄')
    for (const v of ['푸껫', '푸께', '푸껓', '푸껑']) expect(normalizePlaceNameSpellingText(`${v} 빠똥`)).toBe('푸켓 빠똥')
    expect(normalizePlaceNameSpellingText('호찌민 시내')).toBe('호치민 시내')
  })
  it('display never converts common names into 국립국어원 forms', () => {
    const s = '나트랑 푸켓 호치민 씨엠립 크라비 벳부 큐슈 마츠야마 노보리베츠 비엔티엔 꾸따 울루와뚜 도게츠교 다카마츠 쉔부른 튀르키예(터키) 터키항공'
    expect(normalizePlaceNameSpellingText(s)).toBe(s)
    expect(postCheckGeneratedPlaceNames(s).text).toBe(s)
  })
  it('owner 23:44: 시엠립·시엠레아프 → 씨엠립 (U+C528)', () => {
    expect(normalizePlaceNameSpellingText('시엠립 앙코르와트, 시엠레아프 공항')).toBe('씨엠립 앙코르와트, 씨엠립 공항')
    expect('씨엠립'.charCodeAt(0)).toBe(0xc528)
    expect(normalizePlaceNameSpellingText('씨엠립')).toBe('씨엠립')
  })
  it('typos: 효도협·하와리·도톰보리', () => {
    expect(normalizePlaceNameSpellingText('효도협 트레킹')).toBe('호도협 트레킹')
    expect(normalizePlaceNameSpellingText('하와리')).toBe('하와이')
    expect(normalizePlaceNameSpellingText('도톰보리')).toBe('도톤보리')
  })
  it('owner 23:53: decided pairs auto-correct', () => {
    const cases: [string, string][] = [
      ['울란바타르 테를지', '울란바토르 테를지'],
      ['북규슈 기타규슈 키타규슈 규슈', '북큐슈 기타큐슈 키타큐슈 큐슈'],
      ['타이페이 101', '타이베이 101'],
      ['돌로미테 트레킹', '돌로미티 트레킹'],
      ['쿠로가와 온천', '구로카와 온천'],
      ['타카마츠 다카마쓰', '다카마츠 다카마츠'],
      ['이태리 싱가폴', '이탈리아 싱가포르'],
    ]
    for (const [a, b] of cases) expect(normalizePlaceNameSpellingText(a), a).toBe(b)
  })
  it('터키 → 튀르키예(터키): airline·이미 병기·튀르키예 단독은 그대로, 이중 적용 없음', () => {
    expect(normalizePlaceNameSpellingText('터키 일주 9일')).toBe('튀르키예(터키) 일주 9일')
    expect(normalizePlaceNameSpellingText('터키항공 직항')).toBe('터키항공 직항')
    expect(normalizePlaceNameSpellingText('터키 항공 카운터')).toBe('터키 항공 카운터')
    expect(normalizePlaceNameSpellingText('튀르키예(터키) 일주')).toBe('튀르키예(터키) 일주')
    expect(normalizePlaceNameSpellingText('튀르키예 일주')).toBe('튀르키예 일주')
    const once = normalizePlaceNameSpellingText('터키/그리스 10일 터키항공')
    expect(once).toBe('튀르키예(터키)/그리스 10일 터키항공')
    expect(normalizePlaceNameSpellingText(once)).toBe(once)
  })
  it('유니버셜 → 유니버설 only inside 유니버설 스튜디오 재팬', () => {
    expect(normalizePlaceNameSpellingText('유니버셜 스튜디오 재팬 입장권')).toBe('유니버설 스튜디오 재팬 입장권')
    expect(normalizePlaceNameSpellingText('유니버셜스튜디오재팬')).toBe('유니버설스튜디오재팬')
    expect(normalizePlaceNameSpellingText('유니버셜 스튜디오 싱가포르')).toBe('유니버셜 스튜디오 싱가포르')
    expect(normalizePlaceNameSpellingText('유니버셜 시티워크')).toBe('유니버셜 시티워크')
  })
  it('kept common forms: reverse (국립국어원) variants unify to the kept form', () => {
    const cases: [string, string][] = [
      ['벳푸 지옥', '벳부 지옥'],
      ['비엔티안', '비엔티엔'],
      ['마쓰야마성', '마츠야마성'],
      ['노보리베쓰 지옥계곡', '노보리베츠 지옥계곡'],
      ['마쓰에성', '마츠에성'],
      ['쿠타 비치', '꾸따 비치'],
      ['울루와투 사원', '울루와뚜 사원'],
      ['도게쓰교', '도게츠교'],
      ['가쓰야마', '카츠야마'],
      ['사쓰마', '사츠마'],
      ['마쓰모토성', '마츠모토성'],
      ['타만미니', '따만미니'],
    ]
    for (const [a, b] of cases) expect(normalizePlaceNameSpellingText(a), a).toBe(b)
    expect(normalizePlaceNameSpellingText('아쿠타가와')).toBe('아쿠타가와')
  })
  it('쉔부른 kept, never to 쇤브룬 (and 쇤브룬 not auto-reversed)', () => {
    expect(normalizePlaceNameSpellingText('쉔부른 궁전')).toBe('쉔부른 궁전')
    expect(normalizePlaceNameSpellingText('쇤브룬 궁전')).toBe('쇤브룬 궁전')
  })
  it('no certain standard is itself rewritten (idempotent dictionary)', () => {
    for (const e of PLACE_NAME_SPELLING_DICTIONARY.filter((x) => x.confidence === 'certain')) {
      expect(normalizePlaceNameSpellingText(e.standard), e.standard).toBe(e.standard)
    }
  })
  it('uncertain names stay as-is', () => {
    const s = '나트랑 푸켓 호치민 혼똠섬 테렐지 츠카사'
    expect(normalizePlaceNameSpelling(s).text).toBe(s)
  })
  it('hanja-reading names allowed (외래어 표기법 4장 2절 4항)', () => {
    const s = '동경 상해 북경 장가계 북해도'
    expect(normalizePlaceNameSpellingText(s)).toBe(s)
  })
  it('no-op returns identical value; non-string passthrough; digits/prices untouched', () => {
    const s = '효도협 2박3일 1,290,000원'
    expect(normalizePlaceNameSpellingText(s)).toBe('호도협 2박3일 1,290,000원')
    expect(normalizePlaceNameSpellingText(null)).toBeNull()
    expect(normalizePlaceNameSpellingText(123 as unknown)).toBe(123)
  })
  it('idempotent', () => {
    const once = normalizePlaceNameSpellingText('푸꾸욱 냐짱 효도협 하와리 이태리')
    expect(normalizePlaceNameSpellingText(once)).toBe(once)
  })
})

describe('flags', () => {
  it('uncertain, suspicious, mixed', () => {
    const f = detectPlaceNameSpellingFlags(['시엠레아프 혼똠섬 푸꾸웍 샤먼 하문'])
    const types = f.map((x) => x.type)
    expect(types).toContain('dictionary_uncertain')
    expect(types).toContain('suspicious_name')
    expect(types).toContain('mixed_spelling')
  })
  it('common words not flagged', () => {
    expect(detectPlaceNameSpellingFlags(['시그니처 굿바이 스트리트 프라자']).filter((x) => x.type === 'suspicious_name')).toEqual([])
  })
})

describe('post-check + prompt', () => {
  it('prompt rule: common names, no 국립국어원 forms, no invented names, no price edits', () => {
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/나트랑·푸켓·호치민·씨엠립/)
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/큐슈·벳부·마츠야마/)
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/튀르키예\(터키\)/)
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).not.toMatch(/마쓰야마|규슈|벳푸/)
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/만들거나 추측/)
    expect(PLACE_NAME_SPELLING_PROMPT_RULE).toMatch(/가격|금액/)
  })
  it('postCheckGeneratedPlaceNames fixes certain + reports flags', () => {
    const r = postCheckGeneratedPlaceNames('푸꼽옥 해변, 혼똠섬')
    expect(r.text).toBe('푸꾸옥 해변, 혼똠섬')
    expect(r.flags.length).toBeGreaterThan(0)
  })
})

describe('rawMeta review', () => {
  it('deterministic merge, unchanged when equal, removed when null', () => {
    const review = buildPlaceNameSpellingReview({ title: '효도협 트레킹', summary: '혼똠섬' })
    expect(review?.autoDisplayFixes[0]).toMatchObject({ field: 'title', variant: '효도협', standard: '호도협' })
    const base = JSON.stringify({ a: 1 })
    const m1 = mergePlaceNameSpellingReviewIntoRawMeta(base, review)
    expect(mergePlaceNameSpellingReviewIntoRawMeta(m1, buildPlaceNameSpellingReview({ title: '효도협 트레킹', summary: '혼똠섬' }))).toBe(m1)
    expect(parsePlaceNameSpellingReviewFromRawMeta(m1)?.version).toBe('n1-v1')
    expect(JSON.parse(m1).a).toBe(1)
    const cleared = mergePlaceNameSpellingReviewIntoRawMeta(m1, null)
    expect(JSON.parse(cleared).placeNameSpellingReview).toBeUndefined()
    expect(buildPlaceNameSpellingReview({ title: '오사카 3일' })).toBeNull()
    expect(mergePlaceNameSpellingReviewIntoRawMeta(base, null)).toBe(base)
  })
})
