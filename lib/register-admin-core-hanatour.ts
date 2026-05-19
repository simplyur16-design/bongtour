/**
 * [P3] 하나투어 관리자 등록 스택 — digest·fingerprint·orchestration이 공유하는 조각만.
 *
 * 스택 맵: `docs/ops/hanatour-admin-register-stack.md`
 * 타 공급사 `register-admin-core-*` 로 승격·공통 레이어 통합 금지.
 */
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-hanatour'

/** preview↔confirm digest·fingerprint에 반영하는 붙여넣기 키 (orchestration `parsePastedBlocks`와 동일) */
export const HANATOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS = [
  'airlineTransport',
  'hotel',
  'optionalTour',
  'shopping',
] as const

export type HanatourRegisterAdminPastedBlockKey = (typeof HANATOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS)[number]

export const HANATOUR_REGISTER_PASTED_BLOCK_MAX_CHARS = 32_000
export const HANATOUR_REGISTER_ORIGIN_URL_MAX_CHARS = 2_000

export type HanatourRegisterAdminPastedBlocksPartial = Partial<
  Pick<RegisterPastedBlocksInput, HanatourRegisterAdminPastedBlockKey>
>

/** parse-and-register 라우트·digest·스냅샷 저장 공통 — `body.pastedBlocks` 4칸만 */
export function parseHanatourRegisterPastedBlocksFromBody(
  body: Record<string, unknown>
): HanatourRegisterAdminPastedBlocksPartial | null {
  const b = body.pastedBlocks
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null
  const o = b as Record<string, unknown>
  const pick = (key: HanatourRegisterAdminPastedBlockKey) => {
    const v = o[key]
    return typeof v === 'string' && v.trim()
      ? v.trim().slice(0, HANATOUR_REGISTER_PASTED_BLOCK_MAX_CHARS)
      : undefined
  }
  const out: HanatourRegisterAdminPastedBlocksPartial = {}
  for (const key of HANATOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS) {
    const v = pick(key)
    if (v) out[key] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

/** fingerprint canonical·digest 입력 정규화 (길이 상한 동일) */
export function normalizeHanatourRegisterOriginUrl(u: string | null | undefined): string {
  try {
    let s = (typeof u === 'string' ? u : String(u ?? '')).trim().replace(/\/+$/, '')
    if (!s) return ''
    if (s.length > HANATOUR_REGISTER_ORIGIN_URL_MAX_CHARS) {
      s = s.slice(0, HANATOUR_REGISTER_ORIGIN_URL_MAX_CHARS)
    }
    return s
  } catch {
    return ''
  }
}
