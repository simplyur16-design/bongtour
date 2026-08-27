/**
 * In-app Eximbay PAYER_AUTH surface — URL classification SSOT.
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: no external browser pay — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: classify external schemes — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: never render bongtour website in pay WebView — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: auth_ok → complete-pa — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-app-install-optional]: EXIMPay+ store is a link, not required — manifest
 * REGRESSION-FREEZE[simplyur-mobile-pay-window-visible]: query href + same-frame window.open — manifest
 */

export type SimplyurCheckoutWebViewNav =
  | { kind: 'complete'; orderId: string; orderNumber: string }
  | { kind: 'auth_ok'; orderId: string; orderNumber: string; payerAuthId: string }
  | { kind: 'cancel_or_fail' }
  | { kind: 'continue' }
  | { kind: 'external_app'; url: string }
  | { kind: 'optional_store_link'; url: string }

const HTTP_RE = /^https?:\/\//i

/**
 * Buy → native `/checkout` (root stack). Query string is required: Expo Router
 * treats `{ pathname: '/checkout', params: { optionApiId } }` from
 * `(tabs)/product/[optionApiId]` as an update of the product screen, so the
 * pay UI never appears.
 * REGRESSION-FREEZE[simplyur-mobile-pay-window-visible]: query href /checkout — manifest
 */
export function simplyurInAppCheckoutHref(optionApiId: string): string {
  const id = optionApiId.trim()
  if (!id) return ''
  return `/checkout?optionApiId=${encodeURIComponent(id)}`
}

export function firstSearchParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return String(v[0] ?? '').trim()
  return String(v ?? '').trim()
}

/**
 * Eximbay `request_pay` opens the hosted UI with `window.open`.
 * Android WebView + `setSupportMultipleWindows={false}` blocks that and
 * never fires `onOpenWindow` — same-frame assign keeps pay in-app.
 * REGRESSION-FREEZE[simplyur-mobile-pay-window-visible]: same-frame window.open — manifest
 */
export const EXIMBAY_WEBVIEW_SAME_FRAME_OPEN_SHIM = `(function(){
  function go(href){
    if (!href) return false;
    var s = String(href);
    if (!s || s === 'about:blank') return false;
    window.location.assign(s);
    return true;
  }
  window.open = function(url){
    if (go(url)) return window;
    var href = '';
    var loc = {
      assign: go,
      replace: go,
      toString: function(){ return href; }
    };
    Object.defineProperty(loc, 'href', {
      get: function(){ return href; },
      set: function(v){ href = String(v || ''); go(href); }
    });
    return {
      closed: false,
      close: function(){ this.closed = true; },
      focus: function(){},
      blur: function(){},
      location: loc,
      document: { write: function(){}, writeln: function(){}, close: function(){}, location: loc }
    };
  };
})();`

export const EXIMBAY_WEBVIEW_SAME_FRAME_OPEN_INJECT = `${EXIMBAY_WEBVIEW_SAME_FRAME_OPEN_SHIM}\ntrue;`

/** EXIMPay+ (Eximbay) — optional. Card / UnionPay do not need this app. */
export const EXIMPAY_PLAY_PACKAGE = 'com.chainrefund.dmplus'
export const EXIMPAY_IOS_APP_ID = '1501470007'
export const EXIMPAY_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${EXIMPAY_PLAY_PACKAGE}`
export const EXIMPAY_APP_STORE_URL = `https://apps.apple.com/app/eximpay/id${EXIMPAY_IOS_APP_ID}`

export function eximbayAppStoreUrlForOs(os: 'ios' | 'android'): string {
  return os === 'ios' ? EXIMPAY_APP_STORE_URL : EXIMPAY_PLAY_STORE_URL
}

/**
 * Play/App Store (or market/intent to those stores).
 * Open as an optional link — never a required checkout step.
 */
export function isOptionalAppStoreUrl(url: string): boolean {
  const raw = url.trim()
  if (!raw) return false
  const u = raw.toLowerCase()
  if (u.startsWith('market://') || u.startsWith('itms-apps://') || u.startsWith('itms://')) return true
  if (u.startsWith('intent://') && (u.includes('play.google') || u.includes('market'))) return true
  if (u.includes(EXIMPAY_PLAY_PACKAGE) || u.includes(`id${EXIMPAY_IOS_APP_ID}`)) return true
  if (u.includes('eximpayplus.com')) return true
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return host === 'play.google.com' || host === 'apps.apple.com' || host === 'itunes.apple.com'
  } catch {
    return false
  }
}

export function storeUrlToOpen(tapped: string, os: 'ios' | 'android'): string {
  const raw = tapped.trim()
  if (HTTP_RE.test(raw)) return raw
  return eximbayAppStoreUrlForOs(os)
}

/** Non-http(s) schemes (Alipay / WeChat / banking apps) — blocked (stay in-app). Store links are optional, not this. */
export function isExternalPaymentAppUrl(url: string): boolean {
  const u = url.trim()
  if (!u || HTTP_RE.test(u) || u.startsWith('about:') || u.startsWith('data:')) return false
  if (u.startsWith('simplyur:')) return false
  if (isOptionalAppStoreUrl(u)) return false
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

  if (isOptionalAppStoreUrl(raw)) {
    return { kind: 'optional_store_link', url: raw }
  }

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
