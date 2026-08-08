/**
 * In-app Eximbay PAYER_AUTH surface — URL classification SSOT.
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: no external browser pay — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: classify external schemes — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: never render bongtour website in pay WebView — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: auth_ok → complete-pa — manifest
 */

export type SimplyurCheckoutWebViewNav =
  | { kind: 'complete'; orderId: string; orderNumber: string }
  | { kind: 'auth_ok'; orderId: string; orderNumber: string; payerAuthId: string }
  | { kind: 'cancel_or_fail' }
  | { kind: 'continue' }
  | { kind: 'external_app'; url: string }

const HTTP_RE = /^https?:\/\//i

/** Non-http(s) schemes (Alipay / WeChat / banking apps) — blocked (stay in-app). */
export function isExternalPaymentAppUrl(url: string): boolean {
  const u = url.trim()
  if (!u || HTTP_RE.test(u) || u.startsWith('about:') || u.startsWith('data:')) return false
  if (u.startsWith('simplyur:')) return false
  return true
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function queryOf(url: string): URLSearchParams {
  try {
    return new URL(url).searchParams
  } catch {
    return new URLSearchParams()
  }
}

function isOurWebsiteHost(host: string): boolean {
  if (!host) return false
  return host === 'bongtour.com' || host === 'www.bongtour.com' || host.endsWith('.bongtour.com')
}

/** Eximbay / issuer hosts allowed during PAYER_AUTH only. */
export function isEximbayAuthHost(host: string): boolean {
  if (!host) return false
  return (
    host === 'eximbay.com' ||
    host.endsWith('.eximbay.com') ||
    host.includes('cardinalcommerce') ||
    host.includes('3ds') ||
    host.includes('acs')
  )
}

/** Classify navigation inside the in-app checkout WebView. */
export function classifySimplyurCheckoutWebViewUrl(url: string): SimplyurCheckoutWebViewNav {
  const raw = (url ?? '').trim()
  if (!raw) return { kind: 'continue' }

  if (isExternalPaymentAppUrl(raw)) {
    return { kind: 'external_app', url: raw }
  }

  if (raw.startsWith('about:') || raw.startsWith('data:')) {
    return { kind: 'continue' }
  }

  // App scheme return from call_from_scheme
  if (raw.startsWith('simplyur:')) {
    try {
      const u = new URL(raw.replace(/^simplyur:/i, 'https://app/'))
      const status = (u.searchParams.get('status') ?? '').trim().toLowerCase()
      const payerAuthId =
        (u.searchParams.get('payer_auth_id') ?? u.searchParams.get('payerauthid') ?? '').trim()
      if (status === 'auth_ok' || payerAuthId) {
        return {
          kind: 'auth_ok',
          orderId: (u.searchParams.get('orderId') ?? '').trim(),
          orderNumber: (u.searchParams.get('orderNumber') ?? '').trim(),
          payerAuthId,
        }
      }
      if (status === 'fail' || status === 'cancel') return { kind: 'cancel_or_fail' }
    } catch {
      /* fall through */
    }
  }

  const host = hostOf(raw)
  const path = pathOf(raw)
  const q = queryOf(raw)

  // Our website host — NEVER render login/checkout/legal pages in the pay WebView.
  if (isOurWebsiteHost(host) || path.startsWith('/simplyur/')) {
    if (/\/checkout\/complete\/?$/i.test(path) || path.includes('/checkout/complete')) {
      return {
        kind: 'complete',
        orderId: (q.get('orderId') ?? '').trim(),
        orderNumber: (q.get('orderNumber') ?? '').trim(),
      }
    }

    if (path.includes('/app-pay-result')) {
      const status = (q.get('status') ?? '').trim().toLowerCase()
      const payerAuthId = (q.get('payer_auth_id') ?? q.get('payerauthid') ?? '').trim()
      // Mobile PAYER_AUTH: never treat return as paid — app must call complete-pa.
      if (status === 'auth_ok' || status === 'ok' || status === 'success' || payerAuthId) {
        return {
          kind: 'auth_ok',
          orderId: (q.get('orderId') ?? '').trim(),
          orderNumber: (q.get('orderNumber') ?? '').trim(),
          payerAuthId,
        }
      }
      return { kind: 'cancel_or_fail' }
    }

    // Eximbay return page may carry payer_auth_id after PAYER_AUTH
    if (path.includes('/checkout/eximbay-return')) {
      const payerAuthId = (q.get('payer_auth_id') ?? q.get('payerauthid') ?? '').trim()
      const rescode = (q.get('rescode') ?? '').trim()
      if (payerAuthId && (!rescode || rescode === '0000')) {
        return {
          kind: 'auth_ok',
          orderId: (q.get('order_id') ?? q.get('orderId') ?? q.get('ref') ?? '').trim(),
          orderNumber: (q.get('orderNumber') ?? '').trim(),
          payerAuthId,
        }
      }
      return { kind: 'cancel_or_fail' }
    }

    return { kind: 'cancel_or_fail' }
  }

  if (isEximbayAuthHost(host)) return { kind: 'continue' }

  // Other https (rare 3DS banks) — allow during auth
  return { kind: 'continue' }
}
