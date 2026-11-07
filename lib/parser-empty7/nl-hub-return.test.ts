/**
 * REGRESSION-FREEZE[parser-nl-hub-and-return-template]: NL 출발 허브·귀국 템플릿 before/after — manifest
 * 제목과 1일차 본문이 같으면 그 허브(김해=부산). 다르면 null + 검수 플래그. 인천 기본값 없음.
 * 귀국일 '체크아웃 후 ○○로 귀국합니다' 는 공급사 문장으로 바꾸거나 비운다.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseNaeiltourScheduleDaysFromTab1 } from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { verygoodtourFactDaysToRegisterSchedule } from '@/lib/verygoodtour-register-api-schedule'
import { ybtourFactDaysToRegisterSchedule } from '@/lib/ybtour-register-api-schedule'
import {
  departureHubConflictReviewFlag,
  resolveSourceDepartureHubDetail,
} from '@/lib/register-pre-photo-package-supplier-rematerialize'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'

const FIX = path.join(process.cwd(), 'tests/fixtures/parser-empty7-1106')
const INVENTED_RETURN = /체크아웃\s*후[^.。]{0,20}귀국합니다/
const day1 = (html: string) => parseNaeiltourScheduleDaysFromTab1(html).find((d) => d.day === 1)
const load = (id: string) =>
  readFileSync(path.join(FIX, `evidence-tree/scratch/nl-dec-v5/pkg-nl-${id}.cp949-decoded.html`), 'utf8')

describe('before: source itself disagrees on the day header', () => {
  it('0016 title and D1 body are 대구 while the header says 부산-후쿠오카', () => {
    const html = load('0016')
    const title = /<meta property="og:title" content="([^"]*)"/.exec(html)![1]!
    const header = /1일차[\s\S]{0,80}?<strong>\s*([^<]+?)\s*<\/strong>/.exec(html)![1]!
    const body = /<h2>(?:\s*<img[^>]*>)?\s*([^<]*공항[^<]*출발[^<]*)<\/h2>/.exec(
      html.split(/<div class="schedule_wrapq?">/i)[1]!,
    )![1]!
    expect(title).toContain('대구')
    expect(header).toContain('부산')
    expect(body).toContain('대구')
    expect(body).not.toContain('체크아웃')
  })

  it('0019/0020 titles say 부산출발, headers say 인천, bodies say 김해', () => {
    for (const id of ['0019', '0020']) {
      const html = load(id)
      const title = /<meta property="og:title" content="([^"]*)"/.exec(html)![1]!
      const header = /1일차[\s\S]{0,80}?<strong>\s*([^<]+?)\s*<\/strong>/.exec(html)![1]!
      const body = /<h2>(?:\s*<img[^>]*>)?\s*([^<]*공항[^<]*출발[^<]*)<\/h2>/.exec(
        html.split(/<div class="schedule_wrapq?">/i)[1]!,
      )![1]!
      expect(title).toContain('부산출발')
      expect(header).toMatch(/인천/)
      expect(body).toMatch(/김해/)
    }
  })

  it('0014 D4 supplier lines are the airport pair, not a checkout sentence', () => {
    const html = load('0014')
    const d4 = html.split(/<div class="schedule_wrapq?">/i).find((p) => /4일차/.test(p.slice(0, 400)))!
    const lines = [...d4.matchAll(/<h2>\s*(?:<img[^>]*>\s*)?([^<]{2,80})<\/h2>/g)].map((m) =>
      m[1]!.replace(/\s+/g, ' ').trim(),
    )
    expect(lines).toEqual(['홍콩 국제공항 출발', '대구 국제공항 도착'])
    expect(lines.join(' ')).not.toMatch(INVENTED_RETURN)
  })
})

describe('after: title + D1 body decide the hub', () => {
  it('0016/0014/0017 stay 대구; 0019/0020 are 부산 because 김해=부산', () => {
    const want: Record<string, string> = { '0014': '대구', '0016': '대구', '0017': '대구', '0019': '부산', '0020': '부산' }
    for (const [id, hub] of Object.entries(want)) {
      const html = load(id)
      const title = /<meta property="og:title" content="([^"]*)"/.exec(html)![1]!
      const resolved = resolveSourceDepartureHubDetail(title, day1(html))
      expect(resolved, id).toMatchObject({ hub, conflict: false })
      expect(departureHubConflictReviewFlag(resolved)).toBeNull()
    }
  })

  it('a real title/body clash is null plus a reviewable conflict flag, never 인천', () => {
    const day = {
      day: 1,
      places: ['인천', '도쿄'],
      hotels: [],
      meals: [],
      transportNote: '인천 - 도쿄',
      sourceDepartureBody: '부산 공항 출발',
    } satisfies RegisterFactScheduleDay
    const resolved = resolveSourceDepartureHubDetail('[대구출발] 예시', day)
    expect(resolved.hub).toBeNull()
    expect(resolved.conflict).toBe(true)
    expect(resolved.titleHub).toBe('대구')
    expect(resolved.bodyHub).toBe('부산')
    expect(departureHubConflictReviewFlag(resolved)).toEqual({
      reviewRequired: true,
      titleHub: '대구',
      bodyHub: '부산',
      headerHub: '인천',
    })
  })

  it('no source hub stays null (does not default to 인천)', () => {
    const resolved = resolveSourceDepartureHubDetail('홍콩 자유여행', {
      day: 1,
      places: ['홍콩'],
      hotels: [],
      meals: [],
      transportNote: null,
    })
    expect(resolved.hub).toBeNull()
    expect(resolved.conflict).toBe(false)
  })

  it('0014 D4 description is the supplier airport lines', () => {
    const rows = naeiltourFactDaysToRegisterSchedule(parseNaeiltourScheduleDaysFromTab1(load('0014')))
    const d4 = rows.find((r) => r.day === 4)!
    expect(d4.description).toBe('홍콩 국제공항 출발 → 대구 국제공항 도착')
    expect(d4.description).not.toMatch(INVENTED_RETURN)
  })
})

describe('after: no supplier return day is given the invented checkout template', () => {
  const builders = {
    hanatour: hanatourFactDaysToRegisterSchedule,
    modetour: (days: RegisterFactScheduleDay[]) => modetourFactDaysToRegisterSchedule(days, { productTitle: null }),
    verygoodtour: verygoodtourFactDaysToRegisterSchedule,
    ybtour: ybtourFactDaysToRegisterSchedule,
    naeiltour: naeiltourFactDaysToRegisterSchedule,
  }

  it.each(Object.entries(builders))('%s hub-only return day does not invent 체크아웃 후 … 귀국합니다', (_name, build) => {
    const rows = build([
      { day: 1, places: ['홍콩', '소호'], hotels: [], meals: [], transportNote: null },
      { day: 2, places: ['인천'], hotels: [], meals: [], transportNote: null },
    ])
    const last = rows.find((r) => r.day === 2)!
    expect(String(last.description ?? '')).not.toMatch(INVENTED_RETURN)
  })

  it('parsed NL return days from the five fixtures do not contain the template', () => {
    for (const id of ['0014', '0016', '0017', '0019', '0020']) {
      const rows = naeiltourFactDaysToRegisterSchedule(parseNaeiltourScheduleDaysFromTab1(load(id)))
      const blob = rows.map((r) => String(r.description ?? '')).join('\n')
      expect(blob, id).not.toMatch(INVENTED_RETURN)
    }
  })
})
