/**
 * 레거시 URL 전용 — 구 클라이언트·북마크 호환.
 *
 * - HTTP·운영 SSOT: `POST /api/travel/parse-and-register-ybtour` (`app/api/travel/parse-and-register-ybtour/route.ts`).
 * - 본 라우트는 동일 `handleParseAndRegisterYbtourRequest`만 호출하며, 신규 연동·문서·관리자 UI는 ybtour 경로만 사용한다.
 * - `brandKey` 정규화는 핸들러/브랜드 유틸에서 `yellowballoon` → `ybtour`로 맞춘다.
 */
import { NextResponse } from 'next/server'
import { handleParseAndRegisterYbtourRequest } from '@/lib/parse-and-register-ybtour-handler'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** @deprecated 신규는 `POST /api/travel/parse-and-register-ybtour`만 사용 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  console.log(
    '[ybtour] phase=register-api entry route=parse-and-register-yellowballoon-deprecated dedicated=ybtour-handler'
  )
  return handleParseAndRegisterYbtourRequest(request)
}
