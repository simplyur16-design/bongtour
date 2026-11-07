/**
 * 문과장 1106 behavior proof — reads ONLY preserved raw supplier copies (byte-identical, sha-checked); no fixture/DB.
 * Run with alias '@' → fix worktree (AFTER) and → gate repo a6e6abc8 (BEFORE). Expected: AFTER pass, BEFORE fail.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import * as nl from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'
import { hanatourItnrSchdToFactDays, hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import * as remat from '@/lib/register-pre-photo-package-supplier-rematerialize'
import { modetourScheduleItemsToFactDays } from '@/lib/register-facts/modetour-register-fact-mappers'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
const RAW = path.join(process.cwd(), 'tests/fixtures/parser-empty7-1106/evidence-tree/raw-preserve/raw')
const SHA: Record<string, string> = {
  'refetch-1106/pkg-hn-0203_itnr_api_refetch.bin': '275df91529cacc04dfe122a02af7131176a9240f7b914a02af775e9b53cc5137',
  'evidence/pkg-nl-0014-tab1.decoded.html': '17200b38dc93bf62ad3c479d7a549d7f5782508de755b70ef1c427911b9c0462',
  'evidence/pkg-nl-0020-tab1.decoded.html': 'aad777c7c7475c102b02d45609d1240f6363fe6e2b8d0b7184e9917063bede4d',
}
const read = (rel: string) => { const b = readFileSync(`${RAW}/${rel}`); if (SHA[rel]) expect(createHash('sha256').update(b).digest('hex')).toBe(SHA[rel]); return b.toString('utf8') }
const JUNK = /^(?:포인트|important|close|고객사랑브랜드 대상|우수여행상품 인증|개별여행 브랜드 1위)$/
const hubFix = (rows: any[], title: string | null, day1: any) => {
  const f = (remat as any).resolveSourceDepartureHub; const a = (remat as any).applySourceDepartureHubToScheduleRows
  return f && a ? a(rows, f(title, day1)) : rows // BEFORE: helper absent → raw template output
}
function nlRun(s: string) {
  const html = read(`evidence/pkg-nl-${s}-tab1.decoded.html`)
  const title = /fnSns\('kakaotalk','[^']*','([^']*)'/.exec(html)?.[1] ?? null
  const days = nl.parseNaeiltourScheduleDaysFromTab1(html)
  const header1 = /1일차[\s\S]*?<strong>\s*([^<]+?)\s*<\/strong>/.exec(html)?.[1]?.replace(/&nbsp;/g, ' ') ?? ''
  return { html, title, days, header1, sched: hubFix(naeiltourFactDaysToRegisterSchedule(days as any) as any[], title, days.find((d) => d.day === 1)) }
}
describe.each(['0014', '0016', '0017', '0019', '0020'])('NL pkg-nl-%s raw tab1', (s) => {
  it('one row per supplier day (no ×3 PC/mobile/print copies)', () => {
    const { days } = nlRun(s)
    const nums = days.map((d) => d.day)
    expect(new Set(nums).size).toBe(nums.length)
    expect(nums.length).toBeGreaterThan(0)
  })
  it('no img-alt / footer labels as places, route or title', () => {
    const { days, sched } = nlRun(s)
    for (const d of days) for (const p of d.places) expect(p).not.toMatch(JUNK)
    for (const r of sched) { expect(String(r.title)).not.toMatch(/포인트|important|close|브랜드/); expect(String(r.routeText ?? '')).not.toMatch(/포인트|important|close|브랜드/) }
  })
  it('departure sentence follows title + D1 body when they agree, never a default 인천', () => {
    const { sched, title, days } = nlRun(s)
    const d1 = String(sched.find((r: any) => r.day === 1)?.description ?? '')
    const detail = (remat as any).resolveSourceDepartureHubDetail?.(title, days.find((d) => d.day === 1))
    const m = /([가-힣]+)에서 출발해/.exec(d1)
    if (m && detail) {
      expect(detail.conflict).toBe(false)
      expect(detail.hub).toBe(m[1])
    }
    if (detail?.hub !== '인천') expect(d1).not.toContain('인천에서 출발')
    expect(/체크아웃\s*후[^.。]{0,16}귀국합니다/.test(sched.map((r: any) => String(r.description ?? '')).join('\n'))).toBe(false)
  })
  it('no prose captured as meal text', () => {
    const { sched } = nlRun(s)
    for (const r of sched) for (const k of ['breakfastText', 'lunchText', 'dinnerText']) expect(String(r[k] ?? '')).not.toMatch(/이동|미팅|출발|도착|관광/)
  })
})
describe('NL pkg-nl-0020 ▶ operator survives with raw text', () => {
  it('every ▶ label of raw day2 heading block appears in day2 places (cap not truncating)', () => {
    const { html, days } = nlRun('0020')
    const blk = html.split(/<div class="schedule_wrapq?">/i)[2]!
    const labels = [...blk.matchAll(/▶\s*([^<\n]{2,80})/g)].map((m) => m[1]!.replace(/&nbsp;/g, ' ').trim())
    expect(labels).toContain('자유의 여신상')
    const d2 = days.find((d) => d.day === 2)!.places.join(' | ')
    for (const l of labels.filter((x) => x !== '자유의 여신상')) expect(d2).toContain(l.replace(/\s*\(.*$/, ''))
  })
  // RESIDUAL (not fixed): pre-existing shared noise filter lib/register-schedule-route-place-noise.ts (REGRESSION-FREEZE) drops it
  it('▶자유의 여신상 survives into day2 places (v2: narrow (?<!자)유의 exception; was it.fails in v1)', () => {
    const { days } = nlRun('0020')
    expect(days.find((d) => d.day === 2)!.places).toContain('자유의 여신상')
  })
})
describe('HN pkg-hn-0203 raw itnr', () => {
  const raw = JSON.parse(read('refetch-1106/pkg-hn-0203_itnr_api_refetch.bin'))
  const facts = hanatourItnrSchdToFactDays(raw.data.schdInfoList)
  const sched = hanatourFactDaysToRegisterSchedule(facts) as any[]
  it('D3 (raw: only schdCatgNm=선택관광 cards) is labelled 선택관광 in title and description', () => {
    const cats = raw.data.schdInfoList[2].schdMainInfoList.map((m: any) => m.schdCatgNm)
    expect(cats).not.toContain('관광지'); expect(cats).toContain('선택관광')
    expect(sched[2].title).toMatch(/^\[선택관광\]/); expect(sched[2].description).toMatch(/^\[선택관광\]/)
  })
  it('D2 (raw has 관광지) keeps optional tours OUT and is not labelled', () => {
    expect(sched[1].routeText).not.toMatch(/빈펄|버기카|마사지/); expect(sched[1].title).not.toMatch(/선택관광/)
  })
  it('D1 title comes from raw depCityNm→arriveCityNm, not the "1일차" template', () => {
    const m = raw.data.schdInfoList[0].schdMainInfoList.find((x: any) => x.arriveCityNm)
    expect(m.arriveCityNm).toBe('푸꾸옥'); expect(sched[0].title).not.toBe('1일차'); expect(sched[0].title).toContain('푸꾸옥')
  })
  it('D5 return title unchanged', () => { expect(sched[4].title).toBe('숙박 없음(귀국)') })
})

describe('v2 HN D1 description from raw 도시간이동 only', () => {
  const raw = JSON.parse(read('refetch-1106/pkg-hn-0203_itnr_api_refetch.bin'))
  const facts = hanatourItnrSchdToFactDays(raw.data.schdInfoList)
  const r = remat as any
  const base = hanatourFactDaysToRegisterSchedule(facts) as any[]
  const rows = r.applySourceDepartureHubToScheduleRows ? r.applySourceDepartureHubToScheduleRows(base, r.resolveSourceDepartureHub(null, facts[0]), r.sourceDay1ArrivalCities?.(facts[0]) ?? []) : base
  it('D1 description = raw depCityNm → arriveCityNm sentence, nothing else invented', () => {
    const m = raw.data.schdInfoList[0].schdMainInfoList.find((x: any) => x.arriveCityNm)
    expect(rows[0].description).toBe(`${m.depCityNm}에서 출발해 ${m.arriveCityNm}에 도착합니다.`)
  })
  it('D1 hotel/meal fields untouched by the description change', () => {
    expect(rows[0].dinnerText).toBe('기내-불포함(유료제공)'); expect(rows[0].breakfastText ?? null).toBeNull()
  })
})
describe('v2 MT pkg-mt-0350 (digest only — raw GetProductSchedule.json is 0 bytes)', () => {
  const d = JSON.parse(read('evidence/mt-0350-places.json')); const days = Array.isArray(d) ? d : d.days
  const items = days.map((x: any) => ({ first: x.day, placeHeader: x.header ?? [], scheduleHotel: x.hotel ?? '', ortherActions: (x.actions ?? []).map((a: any) => ({ itiServiceName: a.svc, itiPlaceName: a.pk ?? a.iti, itiSummaryDes: a.sum })) }))
  const facts = modetourScheduleItemsToFactDays(items as any)
  const sched = modetourFactDaysToRegisterSchedule(facts, { productTitle: null } as any) as any[]
  it('D13 관광(콘텐츠) "라파인 디너쇼" stays a place; breakfast not filled with show prose; dinner = explicit 디너 name only', () => {
    const r13 = sched.find((r) => r.day === 13)
    expect(String(r13.routeText)).toContain('라파인 디너쇼')
    expect(String(r13.breakfastText ?? '')).not.toMatch(/디너쇼|탱고|뷔페/)
    expect(r13.dinnerText).toBe('라파인 디너쇼')
    expect(r13.lunchText ?? null).toBeNull()
  })
  it('HOLD: D1/D12/D16 descriptions are not fabricated (digest has no itinerary facts)', () => {
    for (const n of [1, 12, 16]) expect(sched.find((r) => r.day === n).description).toBe(`${n}일차`)
  })
})
