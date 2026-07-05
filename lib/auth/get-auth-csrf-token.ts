import 'server-only'

import { headers } from 'next/headers'
import { getSiteOrigin } from '@/lib/site-metadata'

/** NextAuth CSRF — 현재 요청 쿠키를 전달해야 form POST 와 토큰이 일치함 */
export async function getAuthCsrfToken(): Promise<string> {
  const base = getSiteOrigin().replace(/\/$/, '')
  const cookie = (await headers()).get('cookie') ?? ''
  try {
    const res = await fetch(`${base}/api/auth/csrf`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { csrfToken?: string }
    return data.csrfToken?.trim() ?? ''
  } catch {
    return ''
  }
}
