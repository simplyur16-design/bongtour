// REGRESSION-FREEZE[simplyur-portone-checkout-p2]: PortOne env SSOT (simplyur only) — manifest
// REGRESSION-FREEZE[simplyur-portone-overseas-pg]: PayPal + KICC channel keys — manifest

import {
  listConfiguredPortoneMethods,
  parseSimplyurPortoneMethod,
  type SimplyurPortoneMethod,
} from "@/lib/simplyur/payments/portone-methods";

export type PortoneCoreEnv = {
  storeId: string;
  apiSecret: string;
  isTestChannel: boolean;
};

export type PortoneEnv = PortoneCoreEnv & {
  /** @deprecated use resolvePortoneChannelKey(method) */
  channelKey: string;
};

export type ResolvePortoneEnvResult =
  | { ok: true; env: PortoneEnv }
  | { ok: false; reason: "portone_env_incomplete"; missing: string[] };

function truthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function readEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = (process.env[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function resolvePortoneCoreEnv(): ResolvePortoneEnvResult {
  const storeId = readEnv("PORTONE_STORE_ID", "portone_store_id");
  const apiSecret = readEnv("PORTONE_API_SECRET", "portone_key", "PORTONE_KEY", "PORTONE_API_KEY");
  const missing: string[] = [];
  if (!storeId) missing.push("PORTONE_STORE_ID");
  if (!apiSecret) missing.push("PORTONE_API_SECRET");
  if (missing.length) return { ok: false, reason: "portone_env_incomplete", missing };

  const envRaw = (process.env.PORTONE_ENV ?? "test").trim().toLowerCase();
  const isTestChannel = envRaw !== "production" || truthyEnv(process.env.PORTONE_TEST_CHANNEL);

  const legacyChannel = (process.env.PORTONE_CHANNEL_KEY ?? "").trim();
  const paypalChannel =
    (process.env.PORTONE_CHANNEL_KEY_PAYPAL ?? "").trim() || legacyChannel;
  const kiccChannel = (process.env.PORTONE_CHANNEL_KEY_KICC ?? "").trim();

  if (!paypalChannel && !kiccChannel) {
    return {
      ok: false,
      reason: "portone_env_incomplete",
      missing: ["PORTONE_CHANNEL_KEY_PAYPAL or PORTONE_CHANNEL_KEY_KICC (or legacy PORTONE_CHANNEL_KEY)"],
    };
  }

  return {
    ok: true,
    env: {
      storeId,
      apiSecret,
      isTestChannel,
      channelKey: paypalChannel || kiccChannel,
    },
  };
}

/** @deprecated prefer resolvePortoneCoreEnv + resolvePortoneChannelKey */
export function resolvePortoneEnv(): ResolvePortoneEnvResult {
  return resolvePortoneCoreEnv();
}

export function resolvePortoneChannelKey(method: SimplyurPortoneMethod): string | null {
  const legacy = (process.env.PORTONE_CHANNEL_KEY ?? "").trim();
  const paypal = (process.env.PORTONE_CHANNEL_KEY_PAYPAL ?? "").trim() || legacy;
  const kicc = (process.env.PORTONE_CHANNEL_KEY_KICC ?? "").trim();
  switch (method) {
    case "paypal":
      return paypal || null;
    case "kicc_wechat":
    case "kicc_alipay_plus":
      return kicc || null;
    default:
      return null;
  }
}

export function listConfiguredPortoneMethodsFromEnv(): SimplyurPortoneMethod[] {
  return listConfiguredPortoneMethods(resolvePortoneChannelKey);
}

export function resolvePortoneMethodChannel(
  methodRaw: unknown,
): { ok: true; method: SimplyurPortoneMethod; channelKey: string } | { ok: false; reason: string } {
  const method = parseSimplyurPortoneMethod(methodRaw);
  if (!method) return { ok: false, reason: "invalid_portone_method" };
  const channelKey = resolvePortoneChannelKey(method);
  if (!channelKey) {
    const envKey =
      method === "paypal" ? "PORTONE_CHANNEL_KEY_PAYPAL" : "PORTONE_CHANNEL_KEY_KICC";
    return { ok: false, reason: `${envKey}_missing` };
  }
  return { ok: true, method, channelKey };
}

/** Absolute webhook URL for PortOne console / noticeUrls. */
export function resolveSimplyurPortoneWebhookUrl(): string | null {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    ""
  ).trim();
  if (!base) return null;
  try {
    const u = new URL(base);
    u.pathname = "/api/simplyur/webhooks/portone";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export const PORTONE_API_ORIGIN = "https://api.portone.io" as const;

/** PortOne console → 결제알림(Webhook) → 웹훅 시크릿 발급 (테스트/실연동 각각). */
// REGRESSION-FREEZE[simplyur-portone-webhook-secret]: PORTONE_WEBHOOK_SECRET SSOT — manifest
export function resolvePortoneWebhookSecret(): string | null {
  const s = readEnv(
    "PORTONE_WEBHOOK_SECRET",
    "portone_webhook_secret",
    "portone_wbbhook_secret",
  );
  return s || null;
}

/** `raw` = 콘솔에서 복사한 문자열 그대로. 미설정 시 SDK 기본(base64) 해석. */
export function resolvePortoneWebhookSecretFormat(): "raw" | "base64" {
  const f = (process.env.PORTONE_WEBHOOK_SECRET_FORMAT ?? "").trim().toLowerCase();
  return f === "raw" ? "raw" : "base64";
}
