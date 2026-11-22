/**
 * 자동 채움(strict) 일차 칸이 기록 없이 비는 길을 막는다.
 * - 사진 찾기 중 예외가 나면 상품 전체가 500 으로 끝나 예외 목록에도 남지 않았다 → 이 칸만 예외로 남기고 다음 일차로 간다.
 * - 찾은 사진이 일차 사진 정책(1200px·출처·용량)에 걸려 버려질 때도 예외로 남긴다.
 * 관문은 그대로다. 사진을 채우지 않고 '왜 비었는지'만 남긴다.
 * REGRESSION-FREEZE[autofill-silent-record-1122]: strict 일차 칸 무기록 공백 금지 — manifest
 */
import type { AcquireFail, AcquireResult } from '@/lib/photo-autofill-acquire'
import type { PhotoException, PhotoExceptionOrigin } from '@/lib/photo-exception-list'

export type SilentRecordCtx = {
  productId: string
  day: number | null
  kind: 'day' | 'cover'
  sight: string | null
  origin: PhotoExceptionOrigin
  now?: () => Date
}

function errorLabel(err: unknown): string {
  const name = err instanceof Error ? err.name || 'Error' : 'Error'
  // 메시지에 주소·키가 섞일 수 있어 앞부분만, URL 은 지운다
  const msg = err instanceof Error ? String(err.message ?? '') : String(err ?? '')
  const clean = msg.replace(/https?:\/\/\S+/g, '<url>').replace(/\s+/g, ' ').trim().slice(0, 80)
  return clean ? `${name}: ${clean}` : name
}

/** acquire 가 던지면 이 칸만 실패(예외 목록 대상)로 돌려준다. */
export async function acquireOrRecordError(run: () => Promise<AcquireResult>, ctx: SilentRecordCtx): Promise<AcquireResult> {
  try {
    return await run()
  } catch (err) {
    const fail: AcquireFail = {
      ok: false,
      skipped: false,
      tried: [],
      exception: {
        productId: ctx.productId,
        day: ctx.day,
        kind: ctx.kind,
        sight: ctx.sight,
        query: null,
        reason: 'acquire_error',
        detail: errorLabel(err),
        origin: ctx.origin,
        at: (ctx.now?.() ?? new Date()).toISOString(),
      },
    }
    return fail
  }
}

/** 채택한 사진이 일차 사진 정책에서 버려진 칸 */
export function dayPolicyDropException(ctx: SilentRecordCtx, reasons: readonly string[]): PhotoException {
  return {
    productId: ctx.productId,
    day: ctx.day,
    kind: ctx.kind,
    sight: ctx.sight,
    query: null,
    reason: `day_policy:${reasons.join(',') || 'unknown'}`.slice(0, 120),
    detail: 'adopted photo dropped by day photo policy',
    origin: ctx.origin,
    at: (ctx.now?.() ?? new Date()).toISOString(),
  }
}
