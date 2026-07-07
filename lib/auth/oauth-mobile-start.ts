/** simplyur 앱 WebBrowser — GET OAuth 시작 (NextAuth v5는 POST /api/auth/signin/* + CSRF) */

export const OAUTH_MOBILE_START_PROVIDERS = ['google', 'apple'] as const
export type OAuthMobileStartProvider = (typeof OAUTH_MOBILE_START_PROVIDERS)[number]

export function isOAuthMobileStartProvider(v: string): v is OAuthMobileStartProvider {
  return (OAUTH_MOBILE_START_PROVIDERS as readonly string[]).includes(v)
}

/** 오픈 리다이렉트 방지 — same-origin 상대 경로만 */
export function safeOAuthCallbackUrl(
  raw: string | null | undefined,
  fallback = '/simplyur/en/my-esim',
): string {
  const v = (raw ?? '').trim()
  if (v.startsWith('/') && !v.startsWith('//')) return v
  return fallback
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** WebBrowser GET → POST signin (웹 SimplyurGoogleSignInForm 과 동일 계약) */
export function buildOAuthAutoPostHtml(args: {
  provider: OAuthMobileStartProvider
  callbackUrl: string
  csrfToken: string
}): string {
  const action = `/api/auth/signin/${args.provider}`
  const csrf = escapeHtmlAttr(args.csrfToken)
  const cb = escapeHtmlAttr(args.callbackUrl)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signing in…</title>
</head>
<body>
<form id="oauth" method="POST" action="${action}">
<input type="hidden" name="csrfToken" value="${csrf}" />
<input type="hidden" name="callbackUrl" value="${cb}" />
<noscript><p><button type="submit">Continue</button></p></noscript>
</form>
<script>document.getElementById('oauth').submit()</script>
</body>
</html>`
}
