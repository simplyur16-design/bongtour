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
  auth_only?: boolean;
};

export type EximbaySessionResult = {
  payment_attempt_id: string;
  order_id: string;
  order_number: string;
  client: EximbayV2Client;
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

/**
 * Mobile: PAYER_AUTH session (auth window only). Server confirm via complete-pa.
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: mobile session PAYER_AUTH — manifest
 */
export async function createSimplyurEximbaySession(input: {
  orderId: string;
  orderNumber: string;
  locale: SimplyurLocale;
  optionApiId: string;
  idempotencyKey: string;
}): Promise<EximbaySessionResult> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const failUrl = `${base}/simplyur/${input.locale}/app-pay-result?status=fail&optionApiId=${encodeURIComponent(input.optionApiId)}`;
  const successUrl = `${base}/simplyur/${input.locale}/app-pay-result?status=auth_ok&orderId=${encodeURIComponent(input.orderId)}&orderNumber=${encodeURIComponent(input.orderNumber)}`;

  const res = await fetch(`${base}/api/bongsim/payments/session`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      order_id: input.orderId,
      idempotency_key: `${input.idempotencyKey}-pay-eximbay`,
      provider: 'eximbay',
      simplyur_locale: input.locale,
      eximbay_ostype: 'M',
      eximbay_transaction_type: 'PAYER_AUTH',
      return_urls: {
        success_url: successUrl,
        fail_url: failUrl,
        cancel_url: failUrl,
      },
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    client?: EximbayV2Client;
    payment_attempt_id?: string;
    order_id?: string;
    order_number?: string;
    error?: string;
  } | null;
  if (!res.ok || !json?.client || json.client.kind !== 'eximbay_v2') {
    throw new Error(json?.error || 'payment_session_failed');
  }
  if (!json.client.sdk_script_url || !json.client.request_pay) {
    throw new Error('payment_session_incomplete');
  }
  if (!json.payment_attempt_id) {
    throw new Error('payment_attempt_missing');
  }
  return {
    payment_attempt_id: json.payment_attempt_id,
    order_id: json.order_id || input.orderId,
    order_number: json.order_number || input.orderNumber,
    client: json.client,
  };
}

export async function completeSimplyurEximbayPayerAuth(input: {
  paymentAttemptId: string;
  orderId?: string;
  payerAuthId?: string;
  locale: SimplyurLocale;
}): Promise<{ ok: true; order_id: string; order_number: string; duplicate?: boolean }> {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${base}/api/simplyur/checkout/eximbay-complete-pa`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      payment_attempt_id: input.paymentAttemptId,
      order_id: input.orderId,
      payer_auth_id: input.payerAuthId,
      simplyur_locale: input.locale,
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    order_id?: string;
    order_number?: string;
    duplicate?: boolean;
    error?: string;
  } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || 'complete_pa_failed');
  }
  return {
    ok: true,
    order_id: json.order_id || '',
    order_number: json.order_number || '',
    duplicate: json.duplicate,
  };
}

/** Auth-only Eximbay bootstrap HTML (PAYER_AUTH — not full PAYMENT window). */
export function buildEximbayPayHtml(sdkScriptUrl: string, requestPay: Record<string, unknown>): string {
  const payload = JSON.stringify(requestPay);
  const src = JSON.stringify(sdkScriptUrl);
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>simplyur secure pay</title>
<style>
  html,body{margin:0;height:100%;background:#FFF7F2;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
  #st{padding:48px 24px;color:#5c6578;text-align:center;font-size:15px}
</style>
</head><body>
<div id="st">Opening secure card authentication…</div>
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
