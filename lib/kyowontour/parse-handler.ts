/**
 * 교원이지(kyowontour) — 관리자 등록 POST 진입점 (Phase 2-C).
 * 인증·요율 제한·JSON 파싱·응답만 담당; 비즈니스 병합은 `orchestration.ts`.
 */
import { NextResponse } from 'next/server'
import { checkAdminApiRateLimit, getClientIp } from '@/lib/admin-api-security'
import {
  runKyowontourRegisterOrchestration,
  type KyowontourAdminFlightInput,
  type KyowontourAdminInputs,
  type KyowontourAdminOptionalTourInput,
  type KyowontourAdminShoppingInput,
} from '@/lib/kyowontour/orchestration'
import { KyowontourRegisterParseError } from '@/lib/kyowontour/register-llm'
import { requireAdmin } from '@/lib/require-admin'

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

function parseAdminInputs(raw: unknown): KyowontourAdminInputs {
  const r = asRecord(raw)
  if (!r) return {}
  const out: KyowontourAdminInputs = {}
  if (r.expectedDayCount != null && Number.isFinite(Number(r.expectedDayCount))) {
    out.expectedDayCount = Number(r.expectedDayCount)
  }
  if (typeof r.productCode === 'string') out.productCode = r.productCode
  if (typeof r.title === 'string') out.title = r.title
  if (r.flight && typeof r.flight === 'object' && !Array.isArray(r.flight)) {
    out.flight = r.flight as KyowontourAdminFlightInput
  }
  if (Array.isArray(r.optionalTours)) {
    out.optionalTours = r.optionalTours as KyowontourAdminOptionalTourInput[]
  }
  if (Array.isArray(r.shoppingItems)) {
    out.shoppingItems = r.shoppingItems as KyowontourAdminShoppingInput[]
  }
  return out
}

export async function handleKyowontourRegisterRequest(request: Request): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const ip = getClientIp(request.headers)
  const { limited, retryAfterSec } = await checkAdminApiRateLimit(ip, 'expensive')
  if (limited) {
    return NextResponse.json(
      { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 })
  }

  const o = asRecord(payload)
  if (!o) {
    return NextResponse.json({ success: false, error: '요청 본문은 JSON 객체여야 합니다.' }, { status: 400 })
  }

  const bodyText =
    typeof o.bodyText === 'string'
      ? o.bodyText
      : typeof o.body === 'string'
        ? o.body
        : typeof o.pastedBody === 'string'
          ? o.pastedBody
          : ''
  if (!bodyText.trim()) {
    return NextResponse.json(
      { success: false, error: 'bodyText(또는 body, pastedBody) 문자열이 필요합니다.' },
      { status: 400 }
    )
  }

  const adminInputs = parseAdminInputs(o.adminInputs)
  const skipScheduleExtract = o.skipScheduleExtract === true
  const skipConnectionTest = o.skipConnectionTest === true

  try {
    const data = await runKyowontourRegisterOrchestration(bodyText, adminInputs, {
      skipScheduleExtract,
      skipConnectionTest,
    })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (KyowontourRegisterParseError.is(e)) {
      return NextResponse.json({ success: false, error: e.message, code: e.code }, { status: 400 })
    }
    console.error('[handleKyowontourRegisterRequest]', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
