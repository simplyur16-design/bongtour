import { NextResponse } from 'next/server'
import { handleParseAndRegisterHanatourRequest } from '@/lib/parse-and-register-hanatour-handler'
import { checkAdminApiRateLimit, getClientIp } from '@/lib/admin-api-security'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const { limited, retryAfterSec } = await checkAdminApiRateLimit(ip, 'expensive')
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }
  console.log(
    '[hanatour] phase=api-entry route=/api/travel/parse-and-register-hanatour supplier=hanatour'
  )
  return handleParseAndRegisterHanatourRequest(request)
}
