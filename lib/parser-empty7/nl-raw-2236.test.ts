/**
 * 문과장 1106 v5 — NL 원문 CP949 bytes (0014/16/17: source-re-read-2236, 0019/20: refetch-1106) → 현 트리.
 * 디코드는 python cp949 strict + 왕복 일치 검증본(scratch/nl-dec-v5/MANIFEST.json); 여기서 raw·decoded sha 재확인.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parseNaeiltourScheduleDaysFromTab1 } from '@/lib/naeiltour-register-api-detail'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'
import { resolveSourceDepartureHubDetail, applySourceDepartureHubToScheduleRows } from '@/lib/register-pre-photo-package-supplier-rematerialize'
const FIX = path.join(process.cwd(), 'tests/fixtures/parser-empty7-1106')
const MAN = JSON.parse(readFileSync(path.join(FIX, 'nl-dec-v5-manifest.json'), 'utf8'))
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const EXPECT: Record<string, { title: string; header: string; body: string; hub: string | null; conflict: boolean }> = {
  '0014': { title: '대구', header: '대구', body: '대구', hub: '대구', conflict: false },
  '0016': { title: '대구', header: '부산', body: '대구', hub: '대구', conflict: false },
  '0017': { title: '대구', header: '대구', body: '대구', hub: '대구', conflict: false },
  '0019': { title: '부산', header: '인천', body: '김해', hub: '부산', conflict: false },
  '0020': { title: '부산', header: '인천', body: '김해', hub: '부산', conflict: false },
}
const HUB = /(인천|김포|김해|부산|대구)/
describe.each(Object.keys(EXPECT))('pkg-nl-%s', (s) => {
  const raw = readFileSync(path.join(FIX, MAN[s].raw)); const html = readFileSync(path.join(FIX, MAN[s].decoded), 'utf8')
  it('raw + decoded sha match manifest', () => { expect(sha(raw)).toBe(MAN[s].rawSha); expect(sha(html)).toBe(MAN[s].decodedSha) })
  it('departure evidence title/header/body exact; resolver never picks on conflict and never defaults 인천', () => {
    const title = /<meta property="og:title" content="([^"]*)"/.exec(html)![1]!
    const header = (/1일차[\s\S]{0,60}?<strong>\s*([^<]+?)\s*<\/strong>/.exec(html)![1]!).split('&nbsp;').pop()!
    const block = html.split(/<div class="schedule_wrapq?">/i)[1]!
    const body = /<h2>(?:\s*<img[^>]*>)?\s*([^<]*공항[^<]*출발[^<]*)<\/h2>/.exec(block)![1]!
    expect({ title: HUB.exec(title)![1], header: HUB.exec(header)![1], body: HUB.exec(body)![1] }).toEqual({ title: EXPECT[s]!.title, header: EXPECT[s]!.header, body: EXPECT[s]!.body })
    const days = parseNaeiltourScheduleDaysFromTab1(html)
    const resolved = resolveSourceDepartureHubDetail(title, days.find((d) => d.day === 1) as any)
    const hub = resolved.hub
    expect(hub).toBe(EXPECT[s]!.hub)
    expect(resolved.conflict).toBe(EXPECT[s]!.conflict)
    const rows = applySourceDepartureHubToScheduleRows(naeiltourFactDaysToRegisterSchedule(days as any) as any[], hub) as any[]
    const d1 = rows.find((r) => r.day === 1)!
    if (hub === null) expect(/(인천|김해|부산|대구)\S{0,3}\s*출발|(인천|김해|부산|대구)에서/.test(`${d1.title} ${d1.description}`)).toBe(false)
    expect(/인천/.test(rows.map((r) => `${r.title} ${r.routeText} ${r.description}`).join(' '))).toBe(false)
  })
})
