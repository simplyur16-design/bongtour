/**
 * 등록(registered) 상품 `highlightPoints` 일괄 정리 — 순수 로직(DB·fs 없음).
 * CLI: scripts/highlight-points-noise-cleanup.mts / scripts/highlight-points-noise-rollback.mts
 *
 * 규칙: lib/highlight-points-supplier-noise.ts 필터가 버리는 "줄 전체" + 필터가 이미 하는 URL 조각 제거만.
 * 남는 줄의 문구·숫자·가격 무변경. highlightPointsRaw·title·일정 원문은 대상 아님.
 * 이 파일은 상대/별칭 import 없이 유지(PC에서 plain node 24 type-strip 으로도 로드되도록).
 */
import { createHash } from 'node:crypto'
import type { HighlightNoiseResult } from './highlight-points-supplier-noise'

export type HighlightFilterFn = (text: string | null | undefined) => HighlightNoiseResult
/** 줄 단독 판정(블록 문맥 없이). 있으면 program_block 중 "문맥으로만 지워진 줄"을 검토 대상으로 표시 */
export type HighlightLineClassifyFn = (line: string) => string | null

const URL_HINT_RE = /https?:\/\/|www\./i

export type HighlightCleanupSourceRow = {
  id: string
  slug: string | null
  supplier: string | null
  highlightPoints: string | null
}

export type HighlightCleanupPlanRow = {
  productId: string
  slug: string | null
  supplier: string | null
  linesBefore: number
  linesAfter: number
  removed: Array<{ line: string; reason: string }>
  urlStripped: number
  /** program_block 으로만 지워진 줄 중, 줄 단독으로는 노이즈 아님(URL·프로그램·브랜드 홍보 아님) → 검토 권장 */
  contextOnlyRemoved: string[]
  /** 쓰기 전 값(backup/apply 낙관적 잠금용 — plan 파일에는 넣지 않음) */
  before: string
  /** 쓸 값. null = 전 줄 노이즈 → 표시는 highlightPointsRaw 필터본 폴백 */
  after: string | null
}

export const HIGHLIGHT_CLEANUP_BACKUP_KIND = 'bongtour.highlightPoints.noise-cleanup.backup.v1'

export function countNonEmptyLines(text: string | null | undefined): number {
  if (typeof text !== 'string') return 0
  return text.split(/\r\n?|\n/).filter((l) => l.trim()).length
}

/** 한 행 → 계획(노이즈 없으면 null: 쓰기 없음) */
export function planHighlightCleanupRow(
  row: HighlightCleanupSourceRow,
  filter: HighlightFilterFn,
  classify?: HighlightLineClassifyFn,
): HighlightCleanupPlanRow | null {
  const before = row.highlightPoints
  if (typeof before !== 'string' || !before.trim()) return null
  const r = filter(before)
  if (r.removed.length === 0 && r.urlStripped === 0) return null
  if ((r.text ?? null) === before) return null
  return {
    productId: row.id,
    slug: row.slug,
    supplier: row.supplier,
    linesBefore: countNonEmptyLines(before),
    linesAfter: countNonEmptyLines(r.text),
    removed: r.removed.map((x) => ({ line: x.line, reason: x.reason })),
    urlStripped: r.urlStripped,
    contextOnlyRemoved: classify
      ? r.removed
          .filter((x) => x.reason === 'program_block' && !URL_HINT_RE.test(x.line) && !classify(x.line))
          .map((x) => x.line)
      : [],
    before,
    after: r.text ?? null,
  }
}

export function buildHighlightCleanupPlan(
  rows: HighlightCleanupSourceRow[],
  filter: HighlightFilterFn,
  classify?: HighlightLineClassifyFn,
): HighlightCleanupPlanRow[] {
  const out: HighlightCleanupPlanRow[] = []
  for (const row of rows) {
    const p = planHighlightCleanupRow(row, filter, classify)
    if (p) out.push(p)
  }
  return out
}

/** plan 파일용(쓰기 값 본문 제외 — 행 식별·줄 수·제거 줄만) */
export function planRowsForReport(plan: HighlightCleanupPlanRow[]) {
  return plan.map((p) => ({
    productId: p.productId,
    slug: p.slug,
    supplier: p.supplier,
    linesBefore: p.linesBefore,
    linesAfter: p.linesAfter,
    removedCount: p.removed.length,
    urlStripped: p.urlStripped,
    becomesEmpty: p.after === null,
    contextOnlyRemoved: p.contextOnlyRemoved,
    removed: p.removed,
  }))
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function planToCsv(plan: HighlightCleanupPlanRow[]): string {
  const head = ['productId', 'slug', 'supplier', 'linesBefore', 'linesAfter', 'removedCount', 'urlStripped', 'becomesEmpty', 'contextOnlyRemovedCount', 'removed']
  const lines = [head.join(',')]
  for (const p of plan) {
    lines.push(
      [
        p.productId,
        p.slug,
        p.supplier,
        p.linesBefore,
        p.linesAfter,
        p.removed.length,
        p.urlStripped,
        p.after === null ? 'Y' : '',
        p.contextOnlyRemoved.length,
        p.removed.map((r) => `[${r.reason}] ${r.line}`).join(' | '),
      ]
        .map(csvCell)
        .join(','),
    )
  }
  // Excel(한글) 호환 BOM
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

export function summarizePlan(plan: HighlightCleanupPlanRow[], scanned: number) {
  const bySupplier: Record<string, number> = {}
  const byReason: Record<string, number> = {}
  for (const p of plan) {
    const k = p.supplier || '(unknown)'
    bySupplier[k] = (bySupplier[k] ?? 0) + 1
    for (const r of p.removed) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1
  }
  return {
    scannedRegistered: scanned,
    rowsToChange: plan.length,
    rowsBecomingEmpty: plan.filter((p) => p.after === null).length,
    rowsWithContextOnlyRemovals: plan.filter((p) => p.contextOnlyRemoved.length > 0).length,
    contextOnlyLinesRemoved: plan.reduce((n, p) => n + p.contextOnlyRemoved.length, 0),
    linesRemoved: plan.reduce((n, p) => n + p.removed.length, 0),
    urlFragmentsStripped: plan.reduce((n, p) => n + p.urlStripped, 0),
    bySupplier,
    byReason,
  }
}

export type HighlightCleanupBackup = {
  kind: typeof HIGHLIGHT_CLEANUP_BACKUP_KIND
  createdAt: string
  scope: 'registered'
  count: number
  rows: Array<{ id: string; slug: string | null; highlightPoints: string; plannedAfter: string | null }>
}

export function buildHighlightCleanupBackup(plan: HighlightCleanupPlanRow[], createdAt: string): HighlightCleanupBackup {
  return {
    kind: HIGHLIGHT_CLEANUP_BACKUP_KIND,
    createdAt,
    scope: 'registered',
    count: plan.length,
    rows: plan.map((p) => ({ id: p.productId, slug: p.slug, highlightPoints: p.before, plannedAfter: p.after })),
  }
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** 백업 파일 바이트 검증 + 파싱. 실패 시 throw(메시지에 본문 없음). */
export function parseVerifiedBackup(bytes: Uint8Array, expectedSha256: string): HighlightCleanupBackup {
  const want = String(expectedSha256 ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(want)) throw new Error('backup_sha256_missing_or_malformed')
  const got = sha256Hex(bytes)
  if (got !== want) throw new Error('backup_sha256_mismatch')
  const parsed = JSON.parse(Buffer.from(bytes).toString('utf8')) as HighlightCleanupBackup
  if (parsed?.kind !== HIGHLIGHT_CLEANUP_BACKUP_KIND || !Array.isArray(parsed.rows)) {
    throw new Error('backup_kind_invalid')
  }
  if (parsed.rows.length !== parsed.count) throw new Error('backup_count_mismatch')
  return parsed
}

export type ApplyDecision =
  | { action: 'write'; id: string; before: string; after: string | null }
  | { action: 'skip'; id: string; reason: 'not_in_backup' | 'changed_since_backup' }

/**
 * apply: 지금 DB로 다시 만든 plan 중, 백업에 같은 before 로 들어 있는 행만 쓴다.
 * (백업 이후 누가 고친 행·백업 없는 행은 건너뜀.)
 */
export function decideApply(plan: HighlightCleanupPlanRow[], backup: HighlightCleanupBackup): ApplyDecision[] {
  const byId = new Map(backup.rows.map((r) => [r.id, r]))
  return plan.map((p): ApplyDecision => {
    const b = byId.get(p.productId)
    if (!b) return { action: 'skip', id: p.productId, reason: 'not_in_backup' }
    if (b.highlightPoints !== p.before) return { action: 'skip', id: p.productId, reason: 'changed_since_backup' }
    return { action: 'write', id: p.productId, before: p.before, after: p.after }
  })
}

export type RollbackDecision =
  | { action: 'restore'; id: string; expectCurrent: string | null; restoreTo: string }
  | { action: 'skip'; id: string; reason: 'already_original' | 'missing_row' | 'changed_after_apply' }

/**
 * rollback: 현재값이 apply 가 쓴 값(plannedAfter)일 때만 백업값으로 되돌림.
 * force=true 면 현재값과 무관하게 되돌림(그 사이 운영 수정도 덮어씀).
 */
export function decideRollback(
  backup: HighlightCleanupBackup,
  current: Map<string, string | null>,
  force: boolean,
): RollbackDecision[] {
  return backup.rows.map((r): RollbackDecision => {
    if (!current.has(r.id)) return { action: 'skip', id: r.id, reason: 'missing_row' }
    const cur = current.get(r.id) ?? null
    if (cur === r.highlightPoints) return { action: 'skip', id: r.id, reason: 'already_original' }
    if (!force && cur !== (r.plannedAfter ?? null)) return { action: 'skip', id: r.id, reason: 'changed_after_apply' }
    return { action: 'restore', id: r.id, expectCurrent: cur, restoreTo: r.highlightPoints }
  })
}

export function countBy<T extends { action: string; reason?: string }>(xs: T[]): Record<string, number> {
  const o: Record<string, number> = {}
  for (const x of xs) {
    const k = x.reason ? `${x.action}:${x.reason}` : x.action
    o[k] = (o[k] ?? 0) + 1
  }
  return o
}
