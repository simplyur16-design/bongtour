/**
 * [P3] 노랑풍선(ybtour) 관리자 등록 스택 — digest·fingerprint·orchestration이 공유하는 조각만.
 *
 * 스택 맵: `docs/ops/ybtour-admin-register-stack.md`
 * 타 공급사 `register-admin-core-*` 로 승격·공통 레이어 통합 금지.
 */
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-ybtour'

/** preview↔confirm digest·fingerprint에 반영하는 붙여넣기 키 (orchestration과 동일) */
export const YBTOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS = [
  'airlineTransport',
  'hotel',
  'optionalTour',
  'shopping',
] as const

export type YbtourRegisterAdminPastedBlockKey = (typeof YBTOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS)[number]

export const YBTOUR_REGISTER_PASTED_BLOCK_MAX_CHARS = 32_000
export const YBTOUR_REGISTER_ORIGIN_URL_MAX_CHARS = 2_000

export type YbtourRegisterAdminPastedBlocksPartial = Partial<
  Pick<RegisterPastedBlocksInput, YbtourRegisterAdminPastedBlockKey>
>

/** REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API만 */
export function parseYbtourRegisterPastedBlocksFromBody(
  _body: Record<string, unknown>
): YbtourRegisterAdminPastedBlocksPartial | null {
  return null
}

/** fingerprint canonical·digest 입력 정규화 (길이 상한 동일) */
export function normalizeYbtourRegisterOriginUrl(u: string | null | undefined): string {
  try {
    let s = (typeof u === 'string' ? u : String(u ?? '')).trim().replace(/\/+$/, '')
    if (!s) return ''
    if (s.length > YBTOUR_REGISTER_ORIGIN_URL_MAX_CHARS) {
      s = s.slice(0, YBTOUR_REGISTER_ORIGIN_URL_MAX_CHARS)
    }
    return s
  } catch {
    return ''
  }
}
