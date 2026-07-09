/**
 * PortOne channel introspection (no secrets printed).
 * Usage: npx tsx scripts/inspect-portone-channels-safe.ts
 *
 * Validates PayPal channel is SPB test per https://help.portone.io/content/paypal
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import {
  PORTONE_API_ORIGIN,
  resolvePortoneChannelKey,
  resolvePortoneCoreEnv,
} from "@/lib/simplyur/payments/portone-env";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });

const SPB_TEST_MERCHANT_IDS = {
  US: "7WBB3CKT63FRG",
  JP: "PX5CTVZJTRXG4",
  IT: "YGVQ2YJLD33W8",
  AU: "4WUX57522RQDA",
  FR: "BEYAGWPTTDCHE",
  ES: "NWF4AFCDU5T68",
  UK: "PA4DULN9V66L6",
  DE: "NKSW9H8SBFNHS",
  KR: "UFYSG9T7RFW2A",
} as const;

function redactKey(key: string): string {
  return key.length > 22 ? `${key.slice(0, 22)}…` : key;
}

async function fetchJson(url: string, secret: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: { Authorization: `PortOne ${secret}` },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function pickChannelFields(raw: Record<string, unknown>) {
  return {
    key: String(raw.key ?? raw.channelKey ?? raw.channel_key ?? "?"),
    name: String(raw.name ?? raw.channelName ?? raw.channel_name ?? "?"),
    pgProvider: String(raw.pgProvider ?? raw.pg_provider ?? "?"),
    type: String(raw.type ?? raw.channelType ?? raw.channel_type ?? "?"),
    pgMerchantId: String(raw.pgMerchantId ?? raw.pg_merchant_id ?? "?"),
    isTest: raw.isTestChannel ?? raw.is_test_channel ?? raw.test ?? "?",
  };
}

async function inspectChannelKey(label: string, channelKey: string, secret: string) {
  const urls = [
    `${PORTONE_API_ORIGIN}/channel-keys/${encodeURIComponent(channelKey)}`,
    `${PORTONE_API_ORIGIN}/channels/${encodeURIComponent(channelKey)}`,
  ];

  console.log(`\n--- ${label} (${redactKey(channelKey)}) ---`);
  for (const url of urls) {
    const { status, body } = await fetchJson(url, secret);
    console.log(`GET ${url.replace(PORTONE_API_ORIGIN, "")} → HTTP ${status}`);
    if (status >= 200 && status < 300 && body && typeof body === "object") {
      const root = body as Record<string, unknown>;
      const ch = (root.channel && typeof root.channel === "object" ? root.channel : root) as Record<
        string,
        unknown
      >;
      const f = pickChannelFields(ch);
      console.log(`  pg=${f.pgProvider} type=${f.type} name=${f.name}`);
      console.log(`  merchantId=${f.pgMerchantId.slice(0, 16)}${f.pgMerchantId.length > 16 ? "…" : ""}`);
      console.log(`  isTest=${String(f.isTest)}`);

      if (label === "PayPal") {
        const mid = f.pgMerchantId.toUpperCase();
        const known = Object.entries(SPB_TEST_MERCHANT_IDS).find(([, v]) => v === mid);
        if (known) console.log(`  [ok] PortOne SPB test Merchant ID (${known[0]})`);
        else if (mid && mid !== "?")
          console.log(`  [warn] Merchant ID not in PortOne SPB test list — use help.portone.io table for test`);
        if (/express|EXPRESS/i.test(`${f.type} ${f.name}`)) {
          console.log(`  [fail] Express Checkout channel — simplyur needs SPB/RT (V2 loadPaymentUI)`);
        }
        if (f.pgProvider.includes("PAYPAL") && /credential|EXPRESS/i.test(`${f.type} ${f.name}`)) {
          console.log(`  [fail] Likely V1 Express — causes PG_PROVIDER_PAYPAL credential error with loadPaymentUI`);
        }
      }
      return;
    }
    if (body && typeof body === "object" && "message" in body) {
      console.log(`  message: ${String((body as { message?: unknown }).message).slice(0, 120)}`);
    }
  }
  console.log("  [warn] Could not introspect channel — verify manually in PortOne console");
}

async function main() {
  console.log("=== inspect-portone-channels-safe ===");
  console.log("SSOT: https://help.portone.io/content/paypal\n");

  const core = resolvePortoneCoreEnv();
  if (!core.ok) {
    console.error(`[fail] env: ${core.missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`storeId: ${core.env.storeId.slice(0, 14)}…`);
  console.log(`isTestChannel flag (env): ${core.env.isTestChannel}`);

  const paypalKey = resolvePortoneChannelKey("paypal");
  const kiccKey = resolvePortoneChannelKey("kicc_wechat");

  const listUrl = `${PORTONE_API_ORIGIN}/channels?storeId=${encodeURIComponent(core.env.storeId)}`;
  const list = await fetchJson(listUrl, core.env.apiSecret);
  console.log(`\nGET /channels?storeId=… → HTTP ${list.status}`);
  if (list.status >= 200 && list.status < 300 && list.body && typeof list.body === "object") {
    const items =
      ((list.body as { items?: unknown[] }).items ??
        (list.body as { channels?: unknown[] }).channels ??
        []) as Record<string, unknown>[];
    console.log(`  ${items.length} channel(s) in store`);
    for (const ch of items) {
      const f = pickChannelFields(ch);
      console.log(`  · ${redactKey(f.key)} pg=${f.pgProvider} type=${f.type} name=${f.name}`);
    }
  }

  if (paypalKey) await inspectChannelKey("PayPal", paypalKey, core.env.apiSecret);
  else console.log("\n[fail] PORTONE_CHANNEL_KEY_PAYPAL missing");

  if (kiccKey) await inspectChannelKey("KICC", kiccKey, core.env.apiSecret);
  else console.log("\n[fail] PORTONE_CHANNEL_KEY_KICC missing");

  console.log("\n--- PortOne PayPal SPB test Merchant IDs (pick one) ---");
  for (const [country, id] of Object.entries(SPB_TEST_MERCHANT_IDS)) {
    console.log(`  ${country}: ${id}${country === "UK" ? " (recommended)" : ""}`);
  }
  console.log("\nDo NOT use PayPal Developer Client ID / NVP-SOAP for SPB test channel.");
}

void main();
