/**
 * `/api/parse-product`, `/api/travel/parse*`, `/api/travel/parse-and-upsert` 요청 본문용.
 *
 * 키·붙여넣기 본문·레거시 표기 요약: [register-supplier-extraction-spec.md](../docs/register-supplier-extraction-spec.md) 「표기·키 SSOT (요약)」.
 * 이 파일: `normalizeParseRequestOriginSource` — 참좋은은 DB 관례상 `normalizeOriginSource`(VERYGOODTOUR)로 수렴(파서 본문 변경 없음).
 *
 * HTTP JSON 복붙 예: 동 문서 부록-2 · [register_schedule_expression_ssot.md](../docs/register_schedule_expression_ssot.md) §15 · [ADMIN-REGISTER-SINGLE-UX.md](../docs/ADMIN-REGISTER-SINGLE-UX.md) §6.1.1.
 */
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { normalizeOriginSource } from '@/lib/supplier-origin'

/** `?debugSupplier=1` 응답 전용 — 운영 클라이언트는 필드 무시 가능 */
export type ParseSupplierInputDebugV1 = {
  /** 요청 본문(또는 파생 raw)에 있던 문자열 그대로 */
  originSourceRequestRaw: string | null
  /** `normalizeParseRequestOriginSource` 직후 */
  originSourceCoerced: string
  /** DB upsert·모듈 선택에 쓰인 최종 `originSource` */
  originSourceEffective: string
}

export function buildParseSupplierInputDebug(args: {
  requestRaw: string | null
  coerced: string
  effective: string
}): ParseSupplierInputDebugV1 {
  return {
    originSourceRequestRaw: args.requestRaw,
    originSourceCoerced: args.coerced,
    originSourceEffective: args.effective,
  }
}

export function normalizeParseRequestOriginSource(
  input: string | null | undefined,
  brandKey?: string | null
): string {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return '직접입력'
  const key = normalizeSupplierOrigin(trimmed)
  if (key === 'verygoodtour') {
    return normalizeOriginSource(trimmed, brandKey ?? 'verygoodtour')
  }
  if (key !== 'etc') return key
  return trimmed
}
