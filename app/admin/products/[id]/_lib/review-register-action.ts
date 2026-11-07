/**
 * 문과장 1106 v4: 관리자 상세 "검수 후 등록" 버튼 동작(화면 재설계 없음).
 * 1) 저장 안 한 편집이 있으면 요청 없이 보류(HOLD) — 편집을 조용히 버리거나 저장본과 다른 내용을 승인하지 않음.
 * 2) remat revision 상품(humanReviewRequired)은 '지금 화면에 불러온 저장본'으로 3축 digest(WebCrypto, 서버와 같은 정본 입력)를 만들어
 *    `{ humanReviewPass: digests }` 단독 PATCH — 서버가 세션 검수자·서버 시각·현재 행으로 기록(불일치 409).
 * 3) 그 다음 `{ registrationStatus: 'registered' }` 단독 PATCH — 서버 가드가 기록을 현재 행과 다시 대조해 원자 승인.
 * legacy(revision 없음) 상품은 기존과 같은 단일 등록 요청.
 */
import { computeInspectedReviewDigests } from '@/lib/register-review-audit-canonical'
import type { Product } from '../_types'

export type ReviewRegisterOutcome =
  | { ok: true; product: Product }
  | { ok: false; hold: true; message: string; reason?: string }

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
}>

const parse = (t: string): Record<string, unknown> | null => {
  try {
    const v = t ? (JSON.parse(t) as unknown) : null
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function runReviewThenRegister(args: {
  id: string
  product: Product
  unsavedEdits: string[]
  fetchImpl?: FetchLike
}): Promise<ReviewRegisterOutcome> {
  const f: FetchLike = args.fetchImpl ?? ((u, i) => fetch(u, i))
  if (args.unsavedEdits.length) {
    return {
      ok: false,
      hold: true,
      reason: 'unsaved_edits',
      message: `저장하지 않은 변경(${args.unsavedEdits.join(', ')})이 있어 등록을 보류했습니다. 먼저 저장한 뒤 검수하세요.`,
    }
  }
  const url = `/api/admin/products/${args.id}`
  const headers = { 'Content-Type': 'application/json' }
  if (args.product.humanReviewRequired) {
    const p = args.product
    const digests = await computeInspectedReviewDigests({
      schedule: p.schedule ?? null,
      bgImageUrl: p.bgImageUrl ?? null,
      bgImageExternalId: p.bgImageExternalId ?? null,
      bgImageStoragePath: p.bgImageStoragePath ?? null,
      bgImageSourceUrl: p.bgImageSourceUrl ?? null,
    })
    if (!digests) return { ok: false, hold: true, reason: 'digest_unavailable', message: '검수 내용 digest 를 만들 수 없어 등록을 보류했습니다(일정 형식 확인).' }
    const r1 = await f(url, { method: 'PATCH', headers, body: JSON.stringify({ humanReviewPass: digests }) })
    const j1 = parse(await r1.text())
    if (!r1.ok || j1?.ok !== true) {
      const reason = typeof j1?.reason === 'string' ? j1.reason : `http_${r1.status}`
      return {
        ok: false,
        hold: true,
        reason,
        message:
          reason === 'inspected_content_mismatch'
            ? '화면에 불러온 내용이 저장본과 달라 검수 기록을 남기지 않았습니다. 새로고침 후 다시 검수하세요.'
            : `검수 기록 실패(${reason}) — 등록 보류`,
      }
    }
  }
  const r2 = await f(url, { method: 'PATCH', headers, body: JSON.stringify({ registrationStatus: 'registered' }) })
  const j2 = parse(await r2.text())
  if (r2.ok && j2 && typeof j2.id === 'string') return { ok: true, product: j2 as unknown as Product }
  const reason = typeof j2?.reason === 'string' ? j2.reason : `http_${r2.status}`
  return { ok: false, hold: true, reason, message: typeof j2?.error === 'string' ? j2.error : `등록 실패(${reason})` }
}
