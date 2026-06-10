import { handlers } from '@/auth'
import { clearAllAuthSessionCookies } from '@/lib/clear-auth-session-cookies'

const { GET, POST: nextAuthPost } = handlers

export { GET }

export async function POST(req: Request) {
  const res = await nextAuthPost(req)
  if (new URL(req.url).pathname.endsWith('/signout')) {
    clearAllAuthSessionCookies(res)
  }
  return res
}
