import { NextResponse } from 'next/server'

/**
 * 네이버 톡톡 파트너센터 Webhook URL 등록·이벤트 수신.
 * 1단계: 등록 검증 통과용 — POST JSON 수신, 로그, `{ ok: true }` 200 만 수행.
 *
 * @see 네이버 톡톡 파트너센터 — Webhook URL, 이벤트(open / send / friend 권장)
 */
export const dynamic = 'force-dynamic'

function parseLooseJsonBody(text: string): unknown {
  const t = text.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return { _raw: t.slice(0, 2000) }
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown = null
  try {
    const raw = await request.text()
    body = parseLooseJsonBody(raw)
  } catch {
    body = { _parseError: true }
  }

  console.log('[naver-talktalk-webhook]', body)

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  )
}
