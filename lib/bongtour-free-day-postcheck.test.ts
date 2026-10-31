/**
 * 톤 1031(봉실장 23:50): 패키지 자유일정 추천일정 사후 검사 — 통과 예(샘플 B D3 최종), 숫자·금지어·숙소 근처 실패 예,
 * 실패한 날은 저장하지 않고 재생성 대상으로 남는지(제미나이는 가짜 응답, DB 없음).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import sampleB from '@/lib/__fixtures__/tone-1031-sample-B-d3.json'

const generateContent = vi.fn()
vi.mock('@/lib/gemini-client', () => ({
  getGenAI: () => ({ getGenerativeModel: () => ({ generateContent: (...a: unknown[]) => generateContent(...a) }) }),
  getModelName: () => 'fake-model',
  geminiTimeoutOpts: () => ({}),
}))

import { checkBongtourFreeDayText, postcheckBongtourFreeDayItinerary } from '@/lib/bongtour-free-day-postcheck'
import {
  fillRegisterScheduleImageKeywordsWithGeminiIfNeeded,
  parseGeminiFreeLeisureRows,
  rejectGeminiFreeLeisureDaysFailingPostcheck,
  scheduleFreeLeisureDaysMissingImageKeyword,
} from '@/lib/register-schedule-image-keyword-gemini-fill'

const b = sampleB.schedule[0]!
const SUMMARY_OK = b.summary

describe('postcheckBongtourFreeDayItinerary', () => {
  it('통과: 샘플 B D3 최종 문장(제목 앞머리 "추천일정 1day"의 1은 숫자로 안 셈)', () => {
    const r = postcheckBongtourFreeDayItinerary({ title: b.title, recommendedRoute: b.recommendedRoute, summary: b.summary })
    expect(r).toEqual({ ok: true, issues: [] })
    expect(checkBongtourFreeDayText('title', '추천일정 반나절 · 호젠지 요코초·도톤보리', { isTitle: true })).toEqual([])
  })

  it('실패: 숫자(요약의 시간·요금, 우리말 수+단위, 제목 앞머리 밖 숫자)', () => {
    for (const s of [
      '저라면 아침에 호젠지 요코초부터 걸어봅니다. 도톤보리까지 약 10분이면 가요. 오후에는 아메리카무라를 구경해 보세요.',
      '도톤보리 유람선은 1,500엔이라 부담 없어요.',
      '아메리카무라에서 두 시간 정도 구경하시면 좋아요.',
    ]) {
      const r = postcheckBongtourFreeDayItinerary({ title: b.title, recommendedRoute: b.recommendedRoute, summary: s })
      expect(r.ok).toBe(false)
      expect(r.issues.map((i) => i.kind)).toContain('number')
    }
    const t = postcheckBongtourFreeDayItinerary({ title: '추천일정 1day · 도톤보리 3곳', summary: SUMMARY_OK })
    expect(t.issues).toEqual([expect.objectContaining({ kind: 'number', field: 'title' })])
  })

  it.each(['최저가', '무조건', '최고', '유명', '제일', '가장', '빠질 수 없는', '피로가 싹'])('실패: 금지어 "%s"', (w) => {
    const r = postcheckBongtourFreeDayItinerary({ title: b.title, summary: `${SUMMARY_OK} 오사카에서 ${w} 좋은 골목이에요.` })
    expect(r.ok).toBe(false)
    expect(r.issues).toContainEqual(expect.objectContaining({ kind: 'banned_word', match: w }))
  })

  it("'자유일정'의 '유일'은 금지어 아님", () => {
    expect(checkBongtourFreeDayText('summary', '자유일정 날은 천천히 걸어 보세요.')).toEqual([])
  })

  it('실패: 호텔 주소 모를 때 숙소 근처 류(숙소 근처·호텔 바로 옆·숙소와 가까운)', () => {
    for (const s of ['저녁은 숙소 근처 라멘집에서 드셔 보세요.', '호텔 바로 옆 골목도 걸어 보세요.', '숙소와 가까운 시장부터 가 보세요.']) {
      const r = postcheckBongtourFreeDayItinerary({ title: b.title, summary: `${SUMMARY_OK} ${s}` })
      expect(r.ok).toBe(false)
      expect(r.issues.map((i) => i.kind)).toEqual(['lodging_near_unknown_hotel'])
    }
    // 주소를 아는 경우(fit)는 허용, '돌아오는 길'은 숙소 거리 말이 아님
    expect(checkBongtourFreeDayText('summary', '호텔에서 가까운 에비스초역부터 가 보세요.', { hotelKnown: true })).toEqual([])
    expect(checkBongtourFreeDayText('summary', '돌아오는 길에 저녁을 드시면 편해요.')).toEqual([])
  })
})

describe('패키지 자유일정 저장 경로 — 검사 실패한 날은 저장하지 않음', () => {
  const productTitle = '[청주출발] 오사카/교토/나라 3일 (1일자유)'
  const rows = () => [
    { day: 1, title: '오사카', routeText: '청주 - 간사이 공항 - 오사카', description: '', imageKeyword: 'Osaka', imageKeyword2: null },
    { day: 2, title: '오사카 추천 1일 자유일정', routeText: '오사카 - 오사카 추천 1일 자유일정', description: '', imageKeyword: '', imageKeyword2: null },
    { day: 3, title: '귀국', routeText: '간사이 공항 - 청주', description: '', imageKeyword: '', imageKeyword2: null },
  ]
  const fakeGemini = (summary: string) =>
    generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ schedule: [{ ...b, day: 2, summary }] }) },
    })

  beforeEach(() => {
    generateContent.mockReset()
    delete process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI
  })

  it('reject 함수: 통과한 날만 남기고 실패한 날은 사유와 함께 뺌(문장은 그대로)', () => {
    const byDay = parseGeminiFreeLeisureRows([
      { ...b, day: 2 },
      { ...b, day: 3, summary: `${SUMMARY_OK} 숙소 근처에서 마무리하세요.` },
    ])
    const { kept, rejected } = rejectGeminiFreeLeisureDaysFailingPostcheck(byDay)
    expect([...kept.keys()]).toEqual([2])
    expect(kept.get(2)!.summary).toBe(SUMMARY_OK)
    expect(rejected).toEqual([{ day: 3, issues: [expect.objectContaining({ kind: 'lodging_near_unknown_hotel' })] }])
  })

  it('통과: 샘플 B D3 요약이 설명에 그대로 저장', async () => {
    fakeGemini(SUMMARY_OK)
    const out = await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(rows(), { supplierKey: 'modetour', productTitle, productDestination: '오사카' })
    expect(out[1]!.description).toBe(SUMMARY_OK)
    expect(out[1]!.title).toMatch(/^추천일정 1day · /)
  })

  it.each([
    ['숫자', `${SUMMARY_OK} 도톤보리 유람선은 1,500엔이에요.`],
    ['금지어', SUMMARY_OK.replace('화려한', '가장 화려한')],
    ['숙소 근처', `${SUMMARY_OK} 저녁은 숙소 근처에서 드세요.`],
  ])('실패(%s): 그 날 행은 원래대로, 템플릿·원문 대체 없음, 다음에 다시 만들 대상', async (_l, summary) => {
    fakeGemini(summary)
    const before = rows()
    const out = await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(rows(), { supplierKey: 'modetour', productTitle, productDestination: '오사카' })
    expect(out[1]!.title).toBe(before[1]!.title)
    expect(out[1]!.description).toBe('')
    expect(out[1]!.routeText).toBe(before[1]!.routeText)
    expect(String(out[1]!.imageKeyword ?? '')).toBe('')
    expect(scheduleFreeLeisureDaysMissingImageKeyword(out, productTitle)).toContain(2)
  })
})
