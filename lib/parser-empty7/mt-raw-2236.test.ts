/**
 * 문과장 1106 v5 — MT 107152259 GetScheduleList 원문(HTTP 200, 1,520,506 B, sha 92e32c64…) → 현 트리 파이프라인.
 * DB·fetch 없음. 비교 기준(D2–D15 불변)은 v4 트리로 같은 원문을 돌린 스냅샷(mt-raw-v4-snapshot.json).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { modetourScheduleItemsToFactDays } from '@/lib/register-facts/modetour-register-fact-mappers'
import { modetourFactDaysToRegisterSchedule, normalizeModetourFactPlaceLabel } from '@/lib/modetour-register-api-schedule'
import path from 'node:path'
import { resolveSourceDepartureHub, applySourceDepartureHubToScheduleRows } from '@/lib/register-pre-photo-package-supplier-rematerialize'
const FIX = path.join(process.cwd(), 'tests/fixtures/parser-empty7-1106')
const P = path.join(FIX, 'evidence-tree/source-re-read-2236/mt-107152259-GetScheduleList.raw.json')
const buf = readFileSync(P)
const items = JSON.parse(buf.toString('utf8')).result.scheduleItemList as any[]
const facts = modetourScheduleItemsToFactDays(items)
const hub = resolveSourceDepartureHub(null, facts.find((d) => d.day === 1) as any)
const rows = applySourceDepartureHubToScheduleRows(modetourFactDaysToRegisterSchedule(facts, { productTitle: null } as any) as any[], hub) as any[]
const snap = JSON.parse(readFileSync(path.join(FIX, 'mt-raw-v4-snapshot.json'), 'utf8'))
const rawLines = (day: number) => (items.find((i) => i.first === day)!.ortherActions as any[]).filter((a) => a.itiServiceCode === 'SSCETC' && !a.itiPlaceName).map((a) => String(a.serviceWITHSummary ?? '').replace(/▶/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
const TEMPLATE = /체크아웃 후|귀국합니다|둘러봅니다|첫날 리듬|이어갑니다|마무리합니다/

describe('MT raw identity', () => {
  it('bytes/sha as manifest; 17 schedule days (15박 17일)', () => {
    expect(buf.length).toBe(1520506)
    expect(createHash('sha256').update(buf).digest('hex')).toBe('92e32c647a62c95c2ed3a1b454d61c9f656b032f361ab669fab718f6265b6960')
    expect(rows.map((r) => r.day)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1))
  })
})
describe('transit days (no 관광 card) use verbatim supplier lines, no template', () => {
  it.each([1, 12, 16, 17])('day %i: description = raw 기타단문 lines (non-※) in order; title = first line or 귀국', (day) => {
    const r = rows.find((x) => x.day === day)!
    const want = rawLines(day).filter((l) => !/^※/.test(l))
    expect(want.length).toBeGreaterThan(0)
    expect(r.description).toBe(want.join(' → ').slice(0, 720))
    expect(TEMPLATE.test(r.description)).toBe(false)
    expect(r.title).toBe(day === 17 ? '귀국' : want[0])
    expect(r.routeText).toBeNull() // 원문에 없는 경유 도시를 route 로 만들지 않음
  })
  it('D1 departs 인천 (ICN) per source; hub=인천 from day-1 header only; ATL/LIM appear only as source lines', () => {
    const d1 = rows.find((x) => x.day === 1)!
    expect(hub).toBe('인천'); expect(d1.description.startsWith('인천(ICN) 국제공항 출발')).toBe(true)
    expect(facts.find((d) => d.day === 1)!.places).toEqual(['인천'])
  })
  it('D16 = JFK 환승 (raw); D17 = 인천(ICN) 국제공항 도착 (raw)', () => {
    expect(rows.find((x) => x.day === 16)!.description).toBe('미국 뉴욕(JFK) 국제공항 도착 후 환승 → 뉴욕 국제공항 출발')
    expect(rows.find((x) => x.day === 17)!.description).toBe('인천(ICN) 국제공항 도착')
  })
})
describe('tour days unchanged vs v4 on the same raw; display cap 7 with full source places kept', () => {
  it('tour days D2–D11, D13–D15 rows identical to v4 snapshot (D12 is a transit day)', () => {
    for (let d = 2; d <= 15; d++) { if (d === 12) continue
      const a = rows.find((x) => x.day === d)!; const b = snap.schedule.find((x: any) => x.day === d)
      expect({ title: a.title, routeText: a.routeText, description: a.description, B: a.breakfastText, L: a.lunchText, D: a.dinnerText }, `day ${d}`).toEqual({ title: b.title, routeText: b.routeText, description: b.description, B: b.breakfastText, L: b.lunchText, D: b.dinnerText })
    }
  })
  it('every raw 관광 itiPlaceName is in supplierOriginal.items; routeText ≤ 7 segments', () => {
    const miss: string[] = []
    for (const it of items) {
      const r = rows.find((x) => x.day === it.first)!
      const names = (r.supplierOriginal?.items ?? []).map((i: any) => String(i.name ?? ''))
      for (const a of it.ortherActions as any[]) {
        if (!/관광/.test(String(a.itiServiceName ?? '')) || !a.itiPlaceName) continue
        const n = normalizeModetourFactPlaceLabel(String(a.itiPlaceName)) ?? String(a.itiPlaceName)
        if (!names.some((x: string) => x === n || x.includes(n) || n.includes(x) && x.length >= 3)) miss.push(`${it.first}:${a.itiPlaceName}`)
      }
      if (r.routeText) expect(String(r.routeText).split(' - ').length).toBeLessThanOrEqual(7)
    }
    console.log('[mt-raw] tour place misses', JSON.stringify(miss))
    expect(miss).toEqual([])
  })
})
