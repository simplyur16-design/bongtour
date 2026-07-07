/**
 * simplyur PortOne payment window E2E verification.
 * Usage: npx tsx scripts/verify-simplyur-portone-payment-window.ts [--base-url=http://localhost:3000]
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import {
  PORTONE_API_ORIGIN,
  resolvePortoneChannelKey,
  resolvePortoneCoreEnv,
} from "@/lib/simplyur/payments/portone-env";
import type { SimplyurPortoneMethod } from "@/lib/simplyur/payments/portone-methods";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });

const baseArg = process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1]?.trim();
const BASE = (baseArg ?? "http://localhost:3000").replace(/\/$/, "");

type StepResult = { ok: boolean; detail: string };

async function inspectPortoneChannels(): Promise<void> {
  const core = resolvePortoneCoreEnv();
  if (!core.ok) throw new Error(`env_incomplete:${core.missing.join(",")}`);

  const paypalKey = resolvePortoneChannelKey("paypal");
  const kiccKey = resolvePortoneChannelKey("kicc_wechat");

  const url = `${PORTONE_API_ORIGIN}/channels?storeId=${encodeURIComponent(core.env.storeId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `PortOne ${core.env.apiSecret}` },
  });
  if (!res.ok) {
    console.log(`[warn] channels API → HTTP ${res.status} (skip channel introspection)`);
    return;
  }

  const body = (await res.json()) as {
    items?: Array<Record<string, unknown>>;
    channels?: Array<Record<string, unknown>>;
  };
  const items = body.items ?? body.channels ?? [];
  console.log(`[ok] PortOne channels API → ${items.length} channel(s)`);

  for (const key of [paypalKey, kiccKey].filter(Boolean) as string[]) {
    const ch = items.find((c) => c.key === key || c.channelKey === key || c.channel_key === key);
    if (!ch) {
      console.log(`[fail] channel key not found in store: ${key.slice(0, 20)}…`);
      continue;
    }
    const pg = String(ch.pgProvider ?? ch.pg_provider ?? "?");
    const type = String(ch.type ?? ch.channelType ?? ch.channel_type ?? "?");
    const name = String(ch.name ?? ch.channelName ?? ch.channel_name ?? "?");
    const mid = String(ch.pgMerchantId ?? ch.pg_merchant_id ?? "?");
    console.log(`[ok] ${key.slice(0, 18)}… → pg=${pg} type=${type} name=${name} merchantId=${mid.slice(0, 12)}…`);
  }
}

async function fetchOptionApiId(): Promise<string> {
  const r = await fetch(`${BASE}/api/simplyur/products/by-country?codes=kr&locale=en`);
  const j = (await r.json()) as {
    pack?: { roaming?: { products?: { option_api_id: string }[] } };
  };
  const id = j.pack?.roaming?.products?.[0]?.option_api_id;
  if (!id) throw new Error("no_product_for_smoke");
  return id;
}

async function createSession(method: SimplyurPortoneMethod, optionApiId: string) {
  const idem = crypto.randomUUID();
  const confirm = await fetch(`${BASE}/api/simplyur/checkout/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lines: [{ option_api_id: optionApiId, quantity: 1 }],
      buyer_email: `portone-smoke-${Date.now()}@example.com`,
      buyer_phone: "",
      idempotency_key: idem,
      simplyur_locale: "en",
      consents: { terms_accepted: true },
    }),
  });
  const cj = (await confirm.json()) as { order?: { order_id: string }; error?: string };
  if (!confirm.ok || !cj.order) {
    throw new Error(`confirm_failed:${confirm.status}:${cj.error ?? "unknown"}`);
  }

  const pay = await fetch(`${BASE}/api/bongsim/payments/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: cj.order.order_id,
      idempotency_key: `${idem}-pay-${method}`,
      provider: "portone",
      simplyur_portone_method: method,
      simplyur_locale: "en",
      return_urls: {
        success_url: `${BASE}/simplyur/en/checkout/complete`,
        fail_url: `${BASE}/simplyur/en/checkout?failed=1`,
        cancel_url: `${BASE}/simplyur/en/checkout?failed=1`,
      },
    }),
  });
  const pj = (await pay.json()) as {
    client?: Record<string, unknown> & { kind?: string; payment_id?: string };
    error?: string;
    details?: unknown;
  };
  if (!pay.ok || pj.client?.kind !== "portone_v2") {
    throw new Error(`session_failed:${pay.status}:${pj.error ?? JSON.stringify(pj.details ?? {})}`);
  }
  return pj.client;
}

function attachLogging(page: Page, label: string) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || /portone|paypal|payment|mallId|credential/i.test(msg.text())) {
      console.log(`  [${label}] ${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (/portone|paypal|kicc|inicis|nicepay/i.test(url) && res.status() >= 400) {
      console.log(`  [${label}] HTTP ${res.status()} ${url.slice(0, 140)}`);
    }
  });
}

async function waitEnabledSubmit(page: Page) {
  const btn = page.getByRole("button", { name: "Continue to payment" });
  await btn.waitFor({ state: "visible", timeout: 30_000 });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await btn.isEnabled()) return btn;
    await page.waitForTimeout(300);
  }
  throw new Error("submit_button_still_disabled");
}

async function readCheckoutError(page: Page): Promise<string | null> {
  const err = await page.locator(".text-red-600").first().textContent().catch(() => null);
  return err?.trim() || null;
}

async function verifyCheckoutMethod(page: Page, optionApiId: string, method: SimplyurPortoneMethod): Promise<StepResult> {
  attachLogging(page, method);
  const url = `${BASE}/simplyur/en/checkout?optionApiId=${encodeURIComponent(optionApiId)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#su-email", { timeout: 30_000 });

  await page.locator("#su-email").fill(`${method}-smoke-${Date.now()}@example.com`);
  await page.locator('form input[type="checkbox"]').check();

  const methodPattern =
    method === "paypal" ? /PayPal/i : method === "kicc_wechat" ? /WeChat/i : /Alipay/i;
  await page.getByRole("radio", { name: methodPattern }).check();

  const popupPromise =
    method === "paypal"
      ? Promise.resolve(null)
      : page.waitForEvent("popup", { timeout: 60_000 }).catch(() => null);

  const btn = await waitEnabledSubmit(page);
  await btn.click();

  if (method === "paypal") {
    await page.getByText("Pay with PayPal").waitFor({ timeout: 30_000 }).catch(() => undefined);
    const container = page.locator(".portone-ui-container");
    await container.waitFor({ state: "visible", timeout: 15_000 });

    const deadline = Date.now() + 75_000;
    while (Date.now() < deadline) {
      const iframeCount = await container.locator("iframe").count();
      const buttonCount = await container.locator("button, [role='button'], a").count();
      const html = await container.innerHTML();
      if (iframeCount > 0 || buttonCount > 0 || /paypal|zoid|portone/i.test(html)) {
        return { ok: true, detail: `PayPal button rendered (iframes=${iframeCount}, controls=${buttonCount})` };
      }
      const err = await readCheckoutError(page);
      if (err) return { ok: false, detail: err };
      await page.waitForTimeout(1500);
    }
    const err = await readCheckoutError(page);
    return { ok: false, detail: err ?? "paypal_ui_not_rendered" };
  }

  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
    const popupUrl = popup.url();
    const title = await popup.title().catch(() => "");
    await popup.close();
    return { ok: true, detail: `${method} popup opened (${title || popupUrl.slice(0, 100)})` };
  }

  await page.waitForTimeout(6000);
  const current = page.url();
  if (/portone|kicc|inicis|wechat|alipay|payment/i.test(current) && !current.includes("/checkout?")) {
    return { ok: true, detail: `${method} redirected → ${current.slice(0, 120)}` };
  }

  const err = await readCheckoutError(page);
  return { ok: false, detail: err ?? `${method}_no_payment_window` };
}

async function main() {
  console.log(`=== simplyur PortOne payment window E2E (${BASE}) ===\n`);

  await inspectPortoneChannels();

  const optionApiId = await fetchOptionApiId();
  console.log(`[ok] product optionApiId=${optionApiId.slice(0, 8)}…`);

  for (const method of ["paypal", "kicc_wechat", "kicc_alipay_plus"] as const) {
    const client = await createSession(method, optionApiId);
    console.log(
      `[ok] session ${method} → paymentId=${String(client.payment_id).slice(0, 16)}… amount=${client.total_amount_minor} ${client.charge_currency}`,
    );
  }

  const results: Array<{ method: SimplyurPortoneMethod; result: StepResult }> = [];

  for (const method of ["paypal", "kicc_wechat", "kicc_alipay_plus"] as const) {
    console.log(`\n--- browser: ${method} ---`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const shot = resolve(process.cwd(), `tmp-portone-${method}.png`);
    try {
      const result = await verifyCheckoutMethod(page, optionApiId, method);
      results.push({ method, result });
      if (result.ok) console.log(`[ok] ${result.detail}`);
      else {
        await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
        console.log(`[fail] ${result.detail}${shot ? ` (screenshot: ${shot})` : ""}`);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
      results.push({ method, result: { ok: false, detail } });
      console.log(`[fail] ${detail}${shot ? ` (screenshot: ${shot})` : ""}`);
    } finally {
      await browser.close();
    }
  }

  const failed = results.filter((r) => !r.result.ok);
  console.log("\n=== SUMMARY ===");
  for (const { method, result } of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${method}: ${result.detail}`);
  }

  if (failed.length) {
    console.log("\nFAILED — payment window did not open for:", failed.map((f) => f.method).join(", "));
    if (failed.some((f) => /credential|PG_PROVIDER_PAYPAL/i.test(f.result.detail))) {
      console.log(
        "Hint: PayPal channel must be PortOne V2 SPB with Merchant ID saved in console (not v1 Express).",
      );
    }
    if (failed.some((f) => /mallId/i.test(f.result.detail))) {
      console.log("Hint: KICC overseas channel mallId must be set in PortOne console for the KICC channel key.");
    }
    process.exit(1);
  }

  console.log("\nPASSED — all payment windows verified");
}

void main();
