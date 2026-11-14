/**
 * 한진관광 등록대기 upsert 진입점. 수집 원문(이미 파싱된 JSON)만 받고 사이트는 호출하지 않는다.
 * REGRESSION-FREEZE[hanjintour-register-pending-only]: 라우트는 핸들러만 호출 — manifest
 */
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { handleParseAndRegisterHanjintourRequest } from '@/lib/parse-and-register-hanjintour-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return jsonWithLeakGuard({ error: '인증이 필요합니다.' }, 'travel.parse-and-register-hanjintour.auth', { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonWithLeakGuard(
      { success: false, error: '요청 본문이 올바른 JSON이 아닙니다.' },
      'travel.parse-and-register-hanjintour.bad-json',
      { status: 400 },
    )
  }
  const result = await handleParseAndRegisterHanjintourRequest(prisma, body)
  return jsonWithLeakGuard(result.body, 'travel.parse-and-register-hanjintour.result', { status: result.status })
}
