/**
 * 한진관광 등록 HTTP 핸들러.
 * 본문은 이미 파싱된 목록·출발일·일정이다. 이 핸들러는 공급사 사이트를 호출하지 않는다.
 * 결과는 planHanjintourPendingEnqueue 가 허용한 pending 행만 쓴다.
 * REGRESSION-FREEZE[hanjintour-register-pending-only]: 핸들러는 pending upsert 만 — manifest
 */
import type { PrismaClient } from '@prisma/client'
import { applyHanjintourPendingPlan, planHanjintourPendingEnqueue, type HanjintourRegisterInput } from '@/lib/hanjintour-register'
import { HANJINTOUR_SUPPLIER_KEY } from '@/lib/hanjintour-supplier-key'

function asInput(body: unknown): HanjintourRegisterInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  const gdsNo = String(b.gdsNo ?? '').trim()
  const title = String(b.title ?? '').trim()
  if (!gdsNo || !title) return null
  return {
    gdsNo,
    title,
    categoryPaths: Array.isArray(b.categoryPaths) ? (b.categoryPaths as string[][]) : [],
    departures: Array.isArray(b.departures) ? (b.departures as HanjintourRegisterInput['departures']) : [],
    days: Array.isArray(b.days) ? (b.days as HanjintourRegisterInput['days']) : [],
    existingRows: Array.isArray(b.existingRows) ? (b.existingRows as HanjintourRegisterInput['existingRows']) : [],
    todayIso: typeof b.todayIso === 'string' ? b.todayIso : undefined,
    duration: typeof b.duration === 'string' ? b.duration : null,
    originUrl: typeof b.originUrl === 'string' ? b.originUrl : null,
  }
}

export async function handleParseAndRegisterHanjintourRequest(prisma: PrismaClient, body: unknown) {
  const input = asInput(body)
  if (!input) {
    return { status: 400 as const, body: { success: false, error: 'gdsNo·title·departures 가 필요합니다.', originSource: HANJINTOUR_SUPPLIER_KEY } }
  }
  const plan = planHanjintourPendingEnqueue(input)
  if (!plan.ok) {
    return { status: 200 as const, body: { success: false, originSource: HANJINTOUR_SUPPLIER_KEY, reason: plan.reason, basis: plan.basis ?? null } }
  }
  const applied = await applyHanjintourPendingPlan(prisma, plan)
  if (!applied.ok) {
    return { status: 200 as const, body: { success: false, originSource: HANJINTOUR_SUPPLIER_KEY, reason: applied.reason } }
  }
  return {
    status: 200 as const,
    body: {
      success: true,
      originSource: HANJINTOUR_SUPPLIER_KEY,
      productId: applied.productId,
      registrationStatus: applied.registrationStatus,
      departureCount: plan.departures.length,
    },
  }
}
