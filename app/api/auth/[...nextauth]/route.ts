import { NextResponse, type NextRequest } from 'next/server'
import { handlers } from '@/auth'
import { clearAllAuthSessionCookies } from '@/lib/clear-auth-session-cookies'

const { GET, POST: nextAuthPost } = handlers

export { GET }

function asNextResponse(res: Response): NextResponse {
  if (res instanceof NextResponse) return res
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  })
}

export async function POST(req: NextRequest) {
  const res = await nextAuthPost(req)
  if (req.nextUrl.pathname.endsWith('/signout')) {
    const nextRes = asNextResponse(res)
    clearAllAuthSessionCookies(nextRes)
    return nextRes
  }
  return res
}
