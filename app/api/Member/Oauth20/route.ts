import { NextResponse } from 'next/server'
import { handleNaverUnlinkNotificationFromBody } from '@/lib/naver-unlink-callback'

/**
 * 네이버 개발자센터 > 연결 끊기 Callback URL (레거시 경로 유지).
 * @see https://developers.naver.com/docs/login/devguide/devguide.md §4.4
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  const text = await request.text()
  const body = new URLSearchParams(text)
  const status = await handleNaverUnlinkNotificationFromBody(body)
  if (status === 204) {
    return new NextResponse(null, { status: 204 })
  }
  return NextResponse.json({ ok: false }, { status })
}
