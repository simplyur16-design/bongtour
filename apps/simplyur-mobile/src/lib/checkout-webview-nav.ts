/**
 * In-app Eximbay checkout WebView — URL classification SSOT.
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: no external browser pay — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: classify external schemes — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: never render bongtour website in pay WebView — manifest
 */

export type SimplyurCheckoutWebViewNav =
  | { kind: 'complete'; orderId: string; orderNumber: string }
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

  const host = hostOf(raw)
  const path = pathOf(raw)
  const q = queryOf(raw)

  // Our website host — NEVER render login/checkout/legal pages in the pay WebView.
  // Only sentinel paths are recognized; everything else returns to the native form.
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
      if (status === 'ok' || status === 'success') {
        return {
          kind: 'complete',
          orderId: (q.get('orderId') ?? '').trim(),
          orderNumber: (q.get('orderNumber') ?? '').trim(),
        }
      }
      return { kind: 'cancel_or_fail' }
    }

    // Website checkout, sign-in, mypage, legal, home — all forbidden chrome
    return { kind: 'cancel_or_fail' }
  }

  // Eximbay / card issuer / 3DS hosts stay in the pay WebView
  return { kind: 'continue' }
}
