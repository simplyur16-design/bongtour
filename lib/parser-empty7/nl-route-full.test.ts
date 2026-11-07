/**
 * 문과장 1106 v3 — NL route: raw ▶ visit facts are never lost from the stored schedule row.
 * routeText is the frozen display formatter (NAEILTOUR_SCHEDULE_ROUTE_MAX=7, REGRESSION-FREEZE[naeiltour-schedule-expression]);
 * the full ordered source list lives in the existing per-day key schedule[i].supplierOriginal.items (no schema change).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as nl from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule, NAEILTOUR_SCHEDULE_ROUTE_MAX } from '@/lib/naeiltour-register-api-schedule'
const RAW = path.join(process.cwd(), 'tests/fixtures/parser-empty7-1106/evidence-tree/raw-preserve/raw/evidence')
const SRC: Record<string, string> = {}
for (const s of ['0014', '0016', '0017', '0019', '0020']) SRC[s] = readFileSync(`${RAW}/pkg-nl-${s}-tab1.decoded.html`, 'utf8')
/** icon_schedule_see 헤딩(방문 항목) 원문 텍스트 — 첫 사본만 */
function rawSeeHeadingsByDay(html: string): Map<number, string[]> {
  const out = new Map<number, string[]>()
  for (const p of html.split(/<div class="schedule_wrapq">/i).slice(1)) {
    const d = Number(/(\d+)일차&nbsp;/.exec(p)?.[1]); if (!d || out.has(d)) continue
    out.set(d, [...p.matchAll(/<h2>\s*<img[^>]*icon_schedule_see[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()).filter((x) => x && !x.startsWith('▶')))
  }
  return out
}
function rawArrowLabelsByDay(html: string): Map<number, string[]> {
  const out = new Map<number, string[]>()
  const parts = html.split(/<div class="schedule_wrapq">/i).slice(1)
  for (const p of parts) {
    const d = Number(/(\d+)일차&nbsp;/.exec(p)?.[1]); if (!d || out.has(d)) continue // first copy only (PC/mobile/print ×3)
    const labels = [...p.matchAll(/▶\s*([^<\n]{2,80})/g)].map((m) => m[1]!.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s*\(.*$/, '').trim()).filter(Boolean)
    out.set(d, labels)
  }
  return out
}
describe.each(Object.keys(SRC))('NL pkg-nl-%s', (s) => {
  const days = nl.parseNaeiltourScheduleDaysFromTab1(SRC[s]!)
  const rows = naeiltourFactDaysToRegisterSchedule(days as any) as any[]
  const raw = rawArrowLabelsByDay(SRC[s]!)
  it('every raw ▶ label is kept in the stored row supplierOriginal.items (no source loss)', () => {
    let n = 0
    for (const [d, labels] of raw) {
      const names = ((rows.find((r) => r.day === d)?.supplierOriginal?.items ?? []) as any[]).map((i) => i.name ?? '').join(' | ')
      // 저장 이름은 원문 ▶ 문구의 앞부분(접미 '관광' 등 기존 정리 규칙) — 원문에 없는 이름 금지
      const arr = names.split(' | ').filter(Boolean)
      for (const l of labels) { n++; expect(arr.some((x) => (l.startsWith(x) && x.length >= Math.min(4, l.length)) || x.startsWith(l)), `day${d} ${l} in ${names}`).toBe(true) }
    }
    console.log(`[nl-route] ${s} raw ▶ labels=${n}`, JSON.stringify([...raw].map(([d, l]) => [d, l.length])))
  })
  it('every raw icon_schedule_see heading (non-▶ markup) maps to a stored name that is its leading text', () => {
    let n = 0
    for (const [d, heads] of rawSeeHeadingsByDay(SRC[s]!)) {
      const names = ((rows.find((r) => r.day === d)?.supplierOriginal?.items ?? []) as any[]).map((i) => String(i.name ?? '')).filter(Boolean)
      for (const h of heads) { n++; expect(names.some((x) => h.startsWith(x)), `day${d} ${h}`).toBe(true) }
    }
    console.log(`[nl-route] ${s} raw see-headings=${n}`)
  })
  it('routeText is display-only: ≤ ROUTE_MAX, ordered prefix of the same places (no invented names)', () => {
    for (const r of rows) {
      const parts = String(r.routeText ?? '').split(' - ').filter(Boolean)
      expect(parts.length).toBeLessThanOrEqual(NAEILTOUR_SCHEDULE_ROUTE_MAX)
      const names = ((r.supplierOriginal?.items ?? []) as any[]).map((i) => i.name).filter(Boolean)
      for (const p of parts) expect(names.some((x: string) => x.includes(p) || p.includes(x)), `day${r.day} ${p}`).toBe(true)
    }
  })
})
it('pkg-nl-0020 D2 exact: 7 raw ▶ labels + 2 header cities = 9 stored, routeText shows first 7', () => {
  const days = nl.parseNaeiltourScheduleDaysFromTab1(SRC['0020']!)
  const r2 = (naeiltourFactDaysToRegisterSchedule(days as any) as any[]).find((r) => r.day === 2)
  expect(rawArrowLabelsByDay(SRC['0020']!).get(2)).toEqual(['황거', '이중교', '히가시교엔', '오다이바', '레인보우 브릿지', '자유의 여신상', '다이바시티에서 자유쇼핑'])
  expect(r2.supplierOriginal.items.map((i: any) => i.name).filter(Boolean)).toEqual(['도쿄', '요코하마', '황거', '이중교', '히가시교엔', '오다이바', '레인보우 브릿지', '자유의 여신상', '다이바시티에서 자유쇼핑'])
  expect(r2.routeText).toBe('도쿄 - 요코하마 - 황거 - 이중교 - 히가시교엔 - 오다이바 - 레인보우 브릿지')
})

function rawCardsByDay(html: string): Map<number, string[]> {
  const out = new Map<number, string[]>()
  for (const p of html.split(/<div class="schedule_wrapq">/i).slice(1)) {
    const d = Number(/(\d+)일차&nbsp;/.exec(p)?.[1]); if (!d || out.has(d)) continue
    out.set(d, [...p.matchAll(/<\/h2>\s*<ul class="desc">\s*<li[^>]*>\s*<h3>([^<]{2,40})(?:<span>|<\/h3>)/g)].map((m) => m[1]!.replace(/&amp;/g, '&').trim()))
  }
  return out
}
describe('v3 POI cards directly after a day heading (ul.desc h3) are represented; misses are exactly the documented ones', () => {
  // 모모치 해변: h2 '시사이드 모모치 해변' 이 카드 이름으로 시작하지 않아 엄격 규칙상 제외.
  // 기화병가·란퐁유엔: 원문 아이콘 icon_schedule_food(식당) — 기존 설계대로 장소에서 제외.
  const KNOWN_MISS = new Set(['0016:1:모모치 해변', '0017:1:모모치 해변', '0014:1:기화병가', '0014:2:란퐁유엔'])
  it.each(Object.keys(SRC))('pkg-nl-%s', (s) => {
    const rows = naeiltourFactDaysToRegisterSchedule(nl.parseNaeiltourScheduleDaysFromTab1(SRC[s]!) as any) as any[]
    const miss: string[] = []; let n = 0
    for (const [d, cards] of rawCardsByDay(SRC[s]!)) {
      const names = ((rows.find((r) => r.day === d)?.supplierOriginal?.items ?? []) as any[]).map((i) => String(i.name ?? '')).filter(Boolean)
      for (const c of cards) { n++; if (!names.some((x) => x.includes(c) || c.includes(x) && x.length >= 4)) miss.push(`${s}:${d}:${c}`) }
    }
    console.log(`[nl-cards] ${s} cards=${n} miss=${JSON.stringify(miss)}`)
    expect(miss.filter((m) => ![...KNOWN_MISS].some((k) => m === k || m.startsWith(k + ' ') || m.startsWith(k + '\u00a0')))).toEqual([])
  })
})
