/**
 * [P3] 참좋은여행(verygoodtour) 관리자 등록 스택 — digest·fingerprint·handler가 공유하는 조각만.
 *
 * 스택 맵: `docs/ops/verygoodtour-admin-register-stack.md`
 * 타 공급사 `register-admin-core-*` 로 승격·공통 레이어 통합 금지.
 */
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-verygoodtour'

/** preview↔confirm digest·fingerprint에 반영하는 붙여넣기 키 (handler와 동일) */
export const VERYGOODTOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS = [
  'airlineTransport',
  'hotel',
  'optionalTour',
  'shopping',
] as const

export type VerygoodtourRegisterAdminPastedBlockKey =
  (typeof VERYGOODTOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS)[number]

export const VERYGOODTOUR_REGISTER_PASTED_BLOCK_MAX_CHARS = 32_000
export const VERYGOODTOUR_REGISTER_ORIGIN_URL_MAX_CHARS = 2_000

export type VerygoodtourRegisterAdminPastedBlocksPartial = Partial<
  Pick<RegisterPastedBlocksInput, VerygoodtourRegisterAdminPastedBlockKey>
>

/** REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API만 */
export function parseVerygoodtourRegisterPastedBlocksFromBody(
  _body: Record<string, unknown>
): VerygoodtourRegisterAdminPastedBlocksPartial | null {
  return null
}

/** fingerprint canonical·digest 입력 정규화 (길이 상한 동일) */
export function normalizeVerygoodtourRegisterOriginUrl(u: string | null | undefined): string {
  try {
    let s = (typeof u === 'string' ? u : String(u ?? '')).trim().replace(/\/+$/, '')
    if (!s) return ''
    if (s.length > VERYGOODTOUR_REGISTER_ORIGIN_URL_MAX_CHARS) {
      s = s.slice(0, VERYGOODTOUR_REGISTER_ORIGIN_URL_MAX_CHARS)
    }
    return s
  } catch {
    return ''
  }
}
