/**
 * 매시 자동 점검 공용 틀 (사장님 2026-11-22 00:12 "다음작업을 미리 준비할수잇는 베이스", 봉실장 제안 00:10).
 * - 점검 항목(HealthCheck)을 배열에 추가만 하면 같은 실행·집계·기록 틀에서 돈다.
 * - kind 'data': 데이터만 자동 수정(fix). 일정 글·title·가격은 고치지 않는다.
 * - kind 'code': 자동으로 못 고치는 코드 문제. 기록만 남긴다(stdout site-health-done).
 * - AI 토큰을 쓰지 않는다. 외부 호출은 각 점검이 간격·지터를 둔다.
 * 새 항목 추가 방법: docs/site-health-checks.md
 * REGRESSION-FREEZE[site-health-hourly-1122]: 항목 추가형 매시 점검, data=자동 수정·code=기록만 — manifest
 */

export type HealthArea = 'photo' | 'seo' | 'aeo' | 'collect' | 'menu'

export type HealthFinding = {
  checkId: string
  /** 상품 id 또는 페이지 경로 */
  target: string
  productId?: string | null
  day?: number | null
  detail: string
}

export type HealthFixResult = { fixed: boolean; note?: string }

export type HealthCheck<C> = {
  id: string
  area: HealthArea
  kind: 'data' | 'code'
  summary: string
  find(ctx: C): Promise<HealthFinding[]> | HealthFinding[]
  fix?(ctx: C, finding: HealthFinding): Promise<HealthFixResult>
}

export type HealthCheckSummary = {
  id: string
  area: HealthArea
  kind: 'data' | 'code'
  found: number
  fixed: number
  remaining: number
  samples: string[]
  error?: string
}

export const SITE_HEALTH_MAX_FIXES_PER_CHECK = 20
export const SITE_HEALTH_SAMPLE_MAX = 5

function errName(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 160) : 'Error'
}

/** 항목 하나가 실패해도 나머지는 계속 돈다 */
export async function runHealthChecks<C>(
  checks: ReadonlyArray<HealthCheck<C>>,
  ctx: C,
  opts: { maxFixesPerCheck?: number } = {},
): Promise<HealthCheckSummary[]> {
  const maxFixes = Math.max(0, opts.maxFixesPerCheck ?? SITE_HEALTH_MAX_FIXES_PER_CHECK)
  const out: HealthCheckSummary[] = []
  for (const c of checks) {
    const s: HealthCheckSummary = { id: c.id, area: c.area, kind: c.kind, found: 0, fixed: 0, remaining: 0, samples: [] }
    try {
      const findings = await c.find(ctx)
      s.found = findings.length
      for (const f of findings) {
        let fixed = false
        if (c.kind === 'data' && c.fix && s.fixed < maxFixes) {
          try {
            fixed = (await c.fix(ctx, f)).fixed
          } catch (e) {
            s.error = errName(e)
          }
        }
        if (fixed) s.fixed++
        else if (s.samples.length < SITE_HEALTH_SAMPLE_MAX) s.samples.push(`${f.target}${f.day ? ` D${f.day}` : ''}: ${f.detail}`.slice(0, 200))
      }
      s.remaining = s.found - s.fixed
    } catch (e) {
      s.error = errName(e)
    }
    out.push(s)
  }
  return out
}

export function healthTotals(list: ReadonlyArray<HealthCheckSummary>): { found: number; fixed: number; codeIssues: number } {
  let found = 0
  let fixed = 0
  let codeIssues = 0
  for (const s of list) {
    found += s.found
    fixed += s.fixed
    if (s.kind === 'code') codeIssues += s.remaining
  }
  return { found, fixed, codeIssues }
}

/** 시각마다 시작 위치를 돌려 매시 다른 표본을 본다 */
export function rotateByHour<T>(list: readonly T[], take: number, now: Date): T[] {
  if (list.length <= take) return [...list]
  const start = (Math.floor(now.getTime() / 3_600_000) * take) % list.length
  return [...list.slice(start), ...list.slice(0, start)].slice(0, take)
}
