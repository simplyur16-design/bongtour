/**
 * In-app Eximbay checkout WebView — URL classification SSOT.
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: no external browser pay — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: classify external schemes — manifest
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

function queryOf(url: string): URLSearchParams {
  try {
    return new URL(url).searchParams
  } catch {
    return new URLSearchParams()
  }
}

/** Classify navigation inside the in-app checkout WebView. */
export function classifySimplyurCheckoutWebViewUrl(url: string): SimplyurCheckoutWebViewNav {
  const raw = (url ?? '').trim()
  if (!raw) return { kind: 'continue' }

  if (isExternalPaymentAppUrl(raw)) {
    return { kind: 'external_app', url: raw }
  }

  const path = pathOf(raw)
  if (!path.startsWith('/simplyur/')) return { kind: 'continue' }

  if (/\/checkout\/complete\/?$/i.test(path) || path.includes('/checkout/complete')) {
    const q = queryOf(raw)
    return {
      kind: 'complete',
      orderId: (q.get('orderId') ?? '').trim(),
      orderNumber: (q.get('orderNumber') ?? '').trim(),
    }
  }

  // App-only sentinel — never load website checkout chrome after cancel/fail
  if (path.includes('/app-pay-result')) {
    const status = (queryOf(raw).get('status') ?? '').trim().toLowerCase()
    if (status === 'fail' || status === 'cancel') return { kind: 'cancel_or_fail' }
    if (status === 'ok' || status === 'success') {
      const q = queryOf(raw)
      return {
        kind: 'complete',
        orderId: (q.get('orderId') ?? '').trim(),
        orderNumber: (q.get('orderNumber') ?? '').trim(),
      }
    }
    return { kind: 'cancel_or_fail' }
  }

  // Legacy Eximbay cancel/fail resume landed on website checkout with failed=1 — intercept, do not render
  if (path.includes('/checkout') && !path.includes('/checkout/eximbay-return')) {
    const failed = (queryOf(raw).get('failed') ?? '').trim()
    if (failed === '1' || failed.toLowerCase() === 'true') {
      return { kind: 'cancel_or_fail' }
    }
    // Any return onto website checkout page = leave pay WebView (native form owns UX)
    return { kind: 'cancel_or_fail' }
  }

  return { kind: 'continue' }
}
