/**
 * simplyur PortOne env + live endpoint smoke (no secrets printed).
 * Usage: npx tsx scripts/verify-simplyur-portone-env.ts [--base-url https://bongtour.com]
 */
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { isSimplyurCheckoutEnabled } from "@/lib/simplyur/checkout/enabled";
import {
  listConfiguredPortoneMethodsFromEnv,
  resolvePortoneCoreEnv,
  resolvePortoneWebhookSecret,
  resolveSimplyurPortoneWebhookUrl,
} from "@/lib/simplyur/payments/portone-env";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });
loadDotenv({ path: resolve(process.cwd(), ".env") });

const REQUIRED = [
  "PORTONE_STORE_ID",
  "PORTONE_API_SECRET",
  "SIMPLYUR_CHECKOUT_ENABLED",
  "NEXT_PUBLIC_SIMPLYUR_CHECKOUT_ENABLED",
] as const;

function envSet(key: string): boolean {
  const v = (process.env[key] ?? "").trim();
  return v.length > 0 && !v.startsWith("#");
}

function ok(msg: string) {
  console.log(`[ok] ${msg}`);
}

function fail(msg: string) {
  console.error(`[fail] ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log("=== verify-simplyur-portone-env ===\n");

  for (const k of REQUIRED) {
    if (envSet(k)) ok(`${k} set`);
    else fail(`${k} missing`);
  }

  const hasPaypal = envSet("PORTONE_CHANNEL_KEY_PAYPAL") || envSet("PORTONE_CHANNEL_KEY");
  const hasKicc = envSet("PORTONE_CHANNEL_KEY_KICC");
  if (hasPaypal) ok("PayPal channel key set");
  else fail("PORTONE_CHANNEL_KEY_PAYPAL (or legacy PORTONE_CHANNEL_KEY) missing");
  if (hasKicc) ok("KICC channel key set");
  else fail("PORTONE_CHANNEL_KEY_KICC missing");

  if (envSet("PORTONE_WEBHOOK_SECRET")) ok("PORTONE_WEBHOOK_SECRET set");
  else fail("PORTONE_WEBHOOK_SECRET missing");

  const core = resolvePortoneCoreEnv();
  if (core.ok) ok(`resolvePortoneCoreEnv: storeId prefix ${core.env.storeId.slice(0, 8)}…`);
  else fail(`resolvePortoneCoreEnv: ${core.missing.join(", ")}`);

  const methods = listConfiguredPortoneMethodsFromEnv();
  ok(`configured payment methods: ${methods.join(", ") || "(none)"}`);

  if (isSimplyurCheckoutEnabled()) ok("simplyur checkout enabled");
  else fail("simplyur checkout disabled");

  const webhookUrl = resolveSimplyurPortoneWebhookUrl();
  if (webhookUrl) ok(`webhook URL (from public env): ${webhookUrl}`);
  else fail("could not resolve webhook URL — set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL");

  const baseArg = process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1]?.trim();
  const bases = [baseArg, "http://localhost:3000", "https://bongtour.com"].filter(Boolean) as string[];

  for (const base of [...new Set(bases)]) {
    console.log(`\n--- HTTP smoke: ${base} ---`);
    try {
      const checkout = `${base.replace(/\/$/, "")}/simplyur/en/checkout?optionApiId=smoke`;
      const r1 = await fetch(checkout, { redirect: "manual" });
      ok(`GET checkout → ${r1.status}`);

      const wh = `${base.replace(/\/$/, "")}/api/simplyur/webhooks/portone`;
      const r2 = await fetch(wh, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "Transaction.Paid", data: { paymentId: "su-test-not-real" } }),
      });
      if (resolvePortoneWebhookSecret()) {
        if (r2.status === 401) ok(`POST webhook unsigned → ${r2.status} (signature required)`);
        else if (r2.status === 200) ok(`POST webhook unsigned → ${r2.status}`);
        else fail(`POST webhook unsigned → ${r2.status} (expected 401 or 200)`);
      } else {
        ok(`POST webhook → ${r2.status}`);
      }
    } catch (e) {
      fail(`HTTP ${base}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(process.exitCode === 1 ? "\nFAILED" : "\nPASSED");
}

void main();
