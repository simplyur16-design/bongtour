/**
 * 한진 화면 수집을 멈추는 사유. 간격은 줄이지 않는다.
 * 403·429·타임아웃이면 그 자리에서 멈추고, 이유만 남긴다.
 * REGRESSION-FREEZE[hanjin-ingest-stop-reason]: 차단·타임아웃은 중단 사유 — manifest
 */
import { HanjintourBlockedError } from '@/lib/hanjintour-http'
import { SupplierFetchError } from '@/lib/supplier-http/supplier-fetch'

export function hanjinWalkStopReason(e: unknown): string | null {
  if (e instanceof HanjintourBlockedError) return `blocked_${e.status}`
  if (e instanceof SupplierFetchError) {
    const kind = e.failure.errorKind
    if (kind === 'timeout' || kind === 'http_429') return kind
    if (e.failure.status === 403) return 'blocked_403'
  }
  if (e instanceof SyntaxError) return 'bad_response'
  return null
}

/** 로그에 남길 짧은 이름. 주소·본문·비밀은 넣지 않는다. */
export function hanjinFailureName(e: unknown): string {
  return hanjinWalkStopReason(e) ?? (e instanceof Error && e.name ? e.name : 'error')
}
