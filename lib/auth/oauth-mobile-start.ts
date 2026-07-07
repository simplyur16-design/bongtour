/** simplyur 앱 WebBrowser — GET OAuth 시작 (NextAuth v5는 POST /api/auth/signin/* + CSRF) */

import {
  safeSimplyurOAuthCallbackPath,
  type OAuthStartReturnTo,
} from '@/lib/auth/simplyur-oauth-callback'

export const OAUTH_MOBILE_START_PROVIDERS = ['google', 'apple'] as const
export type OAuthMobileStartProvider = (typeof OAUTH_MOBILE_START_PROVIDERS)[number]

export type { OAuthStartReturnTo }

export function isOAuthMobileStartProvider(v: string): v is OAuthMobileStartProvider {
  return (OAUTH_MOBILE_START_PROVIDERS as readonly string[]).includes(v)
}

/** @deprecated — use safeSimplyurOAuthCallbackPath from simplyur-oauth-callback */
export function safeOAuthCallbackUrl(
  raw: string | null | undefined,
  fallback = '/simplyur/en/my-esim',
): string {
  return safeSimplyurOAuthCallbackPath(raw, fallback)
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

/** 브라우저에서 CSRF 쿠키를 받은 뒤 POST (서버 signIn 폴백·로컬 디버그용) */
export function buildOAuthClientCsrfPostHtml(args: {
  provider: OAuthMobileStartProvider
  callbackUrl: string
}): string {
  const action = `/api/auth/signin/${args.provider}`
  const cb = escapeHtmlAttr(args.callbackUrl)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signing in…</title>
</head>
<body>
<p id="status">Signing in…</p>
<form id="oauth" method="POST" action="${action}" style="display:none">
<input type="hidden" name="csrfToken" value="" />
<input type="hidden" name="callbackUrl" value="${cb}" />
</form>
<script>
(function () {
  var form = document.getElementById('oauth');
  var status = document.getElementById('status');
  fetch('/api/auth/csrf', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.csrfToken) throw new Error('csrf');
      form.querySelector('[name=csrfToken]').value = j.csrfToken;
      form.submit();
    })
    .catch(function () {
      status.textContent = 'Sign-in could not start. Please try again.';
    });
})();
</script>
<noscript><p><button type="submit" form="oauth">Continue</button></p></noscript>
</body>
</html>`
}

/** @deprecated — use buildOAuthClientCsrfPostHtml (browser-side CSRF) */
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
