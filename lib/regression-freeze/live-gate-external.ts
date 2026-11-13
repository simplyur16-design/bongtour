/**
 * live gate 외부 장애 SKIP / 파서 회귀 FAIL 분리.
 *
 * SKIP은 수집 단계가 재시도 후에도 timeout·연결실패·5xx·429일 때만. 4xx·판매불가·값 불일치는 FAIL.
 * 러너는 manifest에서 `externalNetworkSkip: true`로 표시한 nested npm script에만 SKIP 종료코드를 인정한다.
 *
 * REGRESSION-FREEZE[live-gate-external-skip]: 약속 종료코드 78 = SKIP(허용 게이트만) — manifest
 */
import fs from 'node:fs'
import {
  SUPPLIER_FETCH_TRANSIENT_KINDS,
  type SupplierFetchErrorKind,
} from '../supplier-http/supplier-fetch'

export const LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE = 78

export type LiveGateExternalSkipReason = {
  supplier: string
  gate: string
  part: string
  url: string
  errorKind: SupplierFetchErrorKind
  attempts: number
  elapsedMs: number
}

export type LiveGateFetchErrorLike = Omit<LiveGateExternalSkipReason, 'supplier' | 'gate'>

export type LiveGateFetchVerdict =
  | { verdict: 'proceed' }
  | { verdict: 'skip'; reasons: LiveGateExternalSkipReason[] }
  | { verdict: 'fail'; message: string }

/** 수집 실패 목록 → 진행 / SKIP(외부 장애만) / FAIL(4xx 포함). */
export function classifyLiveGateFetchErrors(
  supplier: string,
  gate: string,
  errors: readonly LiveGateFetchErrorLike[],
): LiveGateFetchVerdict {
  if (errors.length === 0) return { verdict: 'proceed' }
  const hard = errors.filter((e) => !SUPPLIER_FETCH_TRANSIENT_KINDS.has(e.errorKind))
  if (hard.length > 0) {
    return {
      verdict: 'fail',
      message: hard.map((e) => `${e.part}:${e.errorKind} url=${e.url}`).join(', '),
    }
  }
  return { verdict: 'skip', reasons: errors.map((e) => ({ supplier, gate, ...e })) }
}

export function formatLiveGateExternalSkipLine(r: LiveGateExternalSkipReason): string {
  return (
    `SKIP[external] supplier=${r.supplier} gate=${r.gate} part=${r.part} url=${r.url} ` +
    `kind=${r.errorKind} attempts=${r.attempts} elapsed=${(r.elapsedMs / 1000).toFixed(1)}s`
  )
}

export function appendGithubStepSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY?.trim()
  if (!file) return
  try {
    fs.appendFileSync(file, `${markdown}\n`)
  } catch {
    /* summary는 보조 출력 */
  }
}

/** 콘솔 + GitHub Step Summary에 SKIP 사유를 남긴다. 종료는 호출자가 한다. */
export function reportLiveGateExternalSkip(reasons: readonly LiveGateExternalSkipReason[]): void {
  const lines = reasons.map(formatLiveGateExternalSkipLine)
  for (const line of lines) console.warn(line)
  appendGithubStepSummary(['### Live gate SKIP (external)', '', ...lines.map((l) => `- \`${l}\``), ''].join('\n'))
}

export type NestedNpmExitVerdict = 'pass' | 'skip' | 'fail'

/** 러너용 — SKIP 종료코드는 허용 표시된 항목에서만 SKIP, 그 외 비정상 종료는 FAIL. */
export function classifyNestedNpmExit(status: number | null, allowExternalSkip: boolean): NestedNpmExitVerdict {
  if (status === 0) return 'pass'
  if (allowExternalSkip && status === LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE) return 'skip'
  return 'fail'
}
