import { NextResponse } from 'next/server'
import { handleParseAndRegisterModetourRequest } from '@/lib/parse-and-register-modetour-handler'
import { requireAdmin } from '@/lib/require-admin'

/** 풀 등록·일정 보강 Gemini 호출이 길어질 수 있음 — 호스팅 한도 내에서 상한 확장 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  return handleParseAndRegisterModetourRequest(request)
}
