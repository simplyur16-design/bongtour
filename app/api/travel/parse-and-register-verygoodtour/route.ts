import { NextResponse } from 'next/server'
import { handleParseAndRegisterVerygoodtourRequest } from '@/lib/parse-and-register-verygoodtour-handler'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  return handleParseAndRegisterVerygoodtourRequest(request)
}
