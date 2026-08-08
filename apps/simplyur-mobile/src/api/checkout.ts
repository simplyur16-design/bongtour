import { getApiBaseUrl, type SimplyurLocale } from '@/src/constants/simplyur';
import { loadSimplyurSession } from '@/src/lib/session';

export type CheckoutConfirmOrder = {
  order_id: string;
  order_number: string;
};

export type EximbayV2Client = {
  kind: 'eximbay_v2';
  sdk_script_url: string;
  request_pay: Record<string, unknown>;
};

function newIdempotencyKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `su_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await loadSimplyurSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  return headers;
}

export async function confirmSimplyurCheckout(input: {
  optionApiId: string;
  email: string;
  phone: string;
  locale: SimplyurLocale;
  idempotencyKey?: string;
}): Promise<CheckoutConfirmOrder> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${base}/api/simplyur/checkout/confirm`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      lines: [{ option_api_id: input.optionApiId, quantity: 1 }],
      buyer_email: input.email.trim(),
      buyer_phone: input.phone.trim(),
      idempotency_key: input.idempotencyKey ?? newIdempotencyKey(),
      simplyur_locale: input.locale,
      consents: { terms_accepted: true },
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    order?: CheckoutConfirmOrder;
    error?: string;
  } | null;
  if (!res.ok || !json?.order?.order_id) {
    throw new Error(json?.error || 'confirm_failed');
  }
  return json.order;
}

export async function createSimplyurEximbaySession(input: {
  orderId: string;
  orderNumber: string;
  locale: SimplyurLocale;
  optionApiId: string;
  idempotencyKey: string;
}): Promise<EximbayV2Client> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  // Sentinel URLs — WebView classifies + returns to native form; never show website checkout chrome.
  const failUrl = `${base}/simplyur/${input.locale}/app-pay-result?status=fail&optionApiId=${encodeURIComponent(input.optionApiId)}`;
  const successUrl = `${base}/simplyur/${input.locale}/checkout/complete?orderId=${encodeURIComponent(input.orderId)}&orderNumber=${encodeURIComponent(input.orderNumber)}`;

  const res = await fetch(`${base}/api/bongsim/payments/session`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      order_id: input.orderId,
      idempotency_key: `${input.idempotencyKey}-pay-eximbay`,
      provider: 'eximbay',
      simplyur_locale: input.locale,
      eximbay_ostype: 'M',
      return_urls: {
        success_url: successUrl,
        fail_url: failUrl,
        cancel_url: failUrl,
      },
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    client?: EximbayV2Client;
    error?: string;
  } | null;
  if (!res.ok || !json?.client || json.client.kind !== 'eximbay_v2') {
    throw new Error(json?.error || 'payment_session_failed');
  }
  if (!json.client.sdk_script_url || !json.client.request_pay) {
    throw new Error('payment_session_incomplete');
  }
  return json.client;
}

/** Full-screen Eximbay bootstrap HTML (mobile redirect — no website checkout chrome). */
export function buildEximbayPayHtml(sdkScriptUrl: string, requestPay: Record<string, unknown>): string {
  const payload = JSON.stringify(requestPay);
  const src = JSON.stringify(sdkScriptUrl);
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>simplyur pay</title>
<style>
  html,body{margin:0;height:100%;background:#FFF7F2;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
  #st{padding:48px 24px;color:#5c6578;text-align:center;font-size:15px}
</style>
</head><body>
<div id="st">Opening secure payment…</div>
<script src=${src}></script>
<script>
(function(){
  var payload = ${payload};
  function go(){
    if (!window.EXIMBAY || !window.EXIMBAY.request_pay) { setTimeout(go, 40); return; }
    var el = document.getElementById('st');
    if (el) el.textContent = '';
    window.EXIMBAY.request_pay(payload);
  }
  go();
})();
</script>
</body></html>`;
}
