import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { classifyHighlightNoiseLine, filterHighlightPointsSupplierNoise } from './highlight-points-supplier-noise'
import {
  buildHighlightCleanupBackup,
  buildHighlightCleanupPlan,
  decideApply,
  decideRollback,
  parseVerifiedBackup,
  planToCsv,
  planRowsForReport,
  sha256Hex,
  summarizePlan,
} from './highlight-points-noise-cleanup'

const NOISY = [
  '오사카성·도톤보리 관광',
  '싱글룸 추가요금 300,000원',
  '하나투어 고객만을 위한 특별 혜택',
  '자세히 보기 https://www.hanatour.com/promotion/plan/PM0000123',
  '유니버설 스튜디오 1일 자유',
].join('\n')
const CLEAN = '오사카성 관광\r\n유니버설 스튜디오 1일 자유'

const rows = [
  { id: 'a', slug: 'fit-hn-0001', supplier: 'hanatour', highlightPoints: NOISY },
  { id: 'b', slug: 'pkg-yb-0001', supplier: 'ybtour', highlightPoints: CLEAN },
  { id: 'c', slug: 'pkg-hn-0002', supplier: 'hanatour', highlightPoints: '대표번호 1577-1233' },
  { id: 'd', slug: null, supplier: null, highlightPoints: null },
]

describe('highlight-points-noise-cleanup core', () => {
  it('plan: 노이즈 있는 행만, 남는 줄 문구·숫자·가격 그대로', () => {
    const plan = buildHighlightCleanupPlan(rows, filterHighlightPointsSupplierNoise)
    expect(plan.map((p) => p.productId)).toEqual(['a', 'c'])
    const a = plan[0]
    expect(a.after!.split('\n')).toEqual(['오사카성·도톤보리 관광', '싱글룸 추가요금 300,000원', '유니버설 스튜디오 1일 자유'])
    expect(a.linesBefore).toBe(5)
    expect(a.linesAfter).toBe(3)
    expect(a.removed.map((r) => r.reason).sort()).toEqual(['brand_promo', 'url'])
    expect(plan[1].after).toBeNull()
    // 모든 남는 줄은 원문 줄 그대로(부분 수정 없음)
    for (const line of a.after!.split('\n')) expect(NOISY.split('\n')).toContain(line)
    const s = summarizePlan(plan, rows.length)
    expect(s).toMatchObject({ rowsToChange: 2, rowsBecomingEmpty: 1, linesRemoved: 3, bySupplier: { hanatour: 2 } })
  })

  it('plan report/CSV 에는 쓰기 값 본문(before/after) 없음', () => {
    const plan = buildHighlightCleanupPlan(rows, filterHighlightPointsSupplierNoise)
    const rep = JSON.stringify(planRowsForReport(plan))
    expect(rep).not.toContain('싱글룸')
    expect(rep).not.toContain('"before"')
    const csv = planToCsv(plan)
    expect(csv.split('\r\n')[0]).toBe('\uFEFFproductId,slug,supplier,linesBefore,linesAfter,removedCount,urlStripped,becomesEmpty,contextOnlyRemovedCount,removed')
    expect(csv).not.toContain('싱글룸')
    expect(csv).toContain('[brand_promo] 하나투어 고객만을 위한 특별 혜택')
  })

  it('backup sha256 검증 · apply 는 백업과 before 같은 행만', () => {
    const plan = buildHighlightCleanupPlan(rows, filterHighlightPointsSupplierNoise)
    const b = buildHighlightCleanupBackup(plan, '2026-10-30T14:00:00.000Z')
    const bytes = Buffer.from(JSON.stringify(b, null, 1), 'utf8')
    const sha = sha256Hex(bytes)
    expect(() => parseVerifiedBackup(bytes, '')).toThrow('backup_sha256_missing_or_malformed')
    expect(() => parseVerifiedBackup(bytes, '0'.repeat(64))).toThrow('backup_sha256_mismatch')
    const parsed = parseVerifiedBackup(bytes, sha.toUpperCase())
    expect(parsed.rows.find((r) => r.id === 'a')!.highlightPoints).toBe(NOISY)

    const edited = [...rows, { id: 'e', slug: 'x', supplier: 'hanatour', highlightPoints: 'SAFETY&JOY' }]
    edited[0] = { ...edited[0], highlightPoints: NOISY + '\n하나투어 단독 혜택' }
    const plan2 = buildHighlightCleanupPlan(edited, filterHighlightPointsSupplierNoise)
    const d = decideApply(plan2, parsed)
    expect(d.find((x) => x.id === 'a')).toMatchObject({ action: 'skip', reason: 'changed_since_backup' })
    expect(d.find((x) => x.id === 'c')).toMatchObject({ action: 'write', after: null })
    expect(d.find((x) => x.id === 'e')).toMatchObject({ action: 'skip', reason: 'not_in_backup' })
  })

  it('rollback: apply 값일 때만 복원, force 는 덮어씀', () => {
    const plan = buildHighlightCleanupPlan(rows, filterHighlightPointsSupplierNoise)
    const b = buildHighlightCleanupBackup(plan, 'x')
    const cur = new Map<string, string | null>([
      ['a', plan[0].after],
      ['c', '운영자가 고친 문구'],
    ])
    const d = decideRollback(b, cur, false)
    expect(d[0]).toMatchObject({ action: 'restore', id: 'a', restoreTo: NOISY })
    expect(d[1]).toMatchObject({ action: 'skip', reason: 'changed_after_apply' })
    expect(decideRollback(b, cur, true)[1]).toMatchObject({ action: 'restore', expectCurrent: '운영자가 고친 문구' })
    expect(decideRollback(b, new Map([['a', NOISY]]), false).map((x) => x.action + ':' + ('reason' in x ? x.reason : ''))).toEqual([
      'skip:already_original',
      'skip:missing_row',
    ])
  })

  it('CLI 소스 가드: registered 만, highlightPoints 만 쓰기, 확인 env·sha 필수', () => {
    const cli = readFileSync('scripts/highlight-points-noise-cleanup.mts', 'utf8')
    const rb = readFileSync('scripts/highlight-points-noise-rollback.mts', 'utf8')
    const updates = [...cli.matchAll(/UPDATE "Product" SET ([^\n]+)/g), ...rb.matchAll(/UPDATE "Product" SET ([^\n]+)/g)].map((m) => m[1])
    expect(updates.length).toBe(2)
    for (const u of updates) expect(u).toMatch(/^"highlightPoints" = \$2(\s|$)/)
    expect(cli).toContain(`"registrationStatus" = 'registered' AND "highlightPoints" = $3`)
    expect(cli).toContain("process.env.APPLY_CONFIRM !== 'YES'")
    expect(rb).toContain("process.env.ROLLBACK_CONFIRM !== 'YES'")
    expect(cli).toContain('parseVerifiedBackup(')
    const cliCode = cli.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(cliCode).not.toMatch(/highlightPointsRaw|"title"|ItineraryDay|updatedAt/)
    const shared = readFileSync('scripts/highlight-points-noise-shared.mts', 'utf8')
    expect(shared).toContain("'BEGIN READ ONLY'")
    // 앱 코드에서 import 하지 않음(스크립트 전용)
  })

  it('contextOnlyRemoved: 블록 문맥으로만 지워진 일반 줄은 검토 대상으로 표시', () => {
    const t = ['오사카성 관광', 'SAFETY&JOY', '100% 보상 프로그램', '유니버설 1일 자유'].join('\n')
    const [p] = buildHighlightCleanupPlan([{ id: 'z', slug: 's', supplier: 'hanatour', highlightPoints: t }], filterHighlightPointsSupplierNoise, classifyHighlightNoiseLine)
    expect(p.contextOnlyRemoved).toEqual(['유니버설 1일 자유'])
    expect(summarizePlan([p], 1)).toMatchObject({ rowsWithContextOnlyRemovals: 1, contextOnlyLinesRemoved: 1 })
    expect(planToCsv([p])).toContain(',1,[program] SAFETY&JOY')
  })

  it('URL 조각 제거 시 줄 앞 공백 안 생김', () => {
    const [p] = buildHighlightCleanupPlan([{ id: 'u', slug: 's', supplier: 'h', highlightPoints: '관광 A\nwww.hanatour.com 관광 B 안내' }], filterHighlightPointsSupplierNoise)
    expect(p.after).toBe('관광 A\n관광 B 안내')
  })
})
