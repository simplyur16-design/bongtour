/**
 * Simplyur 외국인 eSIM — Eximbay PG env / Basic Auth / base URL SSOT.
 * 봉투어 웰컴페이먼츠와 분리. PortOne 실결제 경로와 병행(연동 준비 단계).
 * REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: Eximbay env + Basic Auth — manifest
 */

export const EXIMBAY_API_ORIGIN_TEST = "https://api-test.eximbay.com" as const;
export const EXIMBAY_API_ORIGIN_LIVE = "https://api.eximbay.com" as const;

export type EximbayEnvMode = "test" | "production";

export type EximbayEnv = {
  mid: string;
  apiKey: string;
  mode: EximbayEnvMode;
  apiOrigin: string;
  sdkScriptUrl: string;
};

export type ResolveEximbayEnvResult =
  | { ok: true; env: EximbayEnv }
  | { ok: false; reason: "eximbay_env_incomplete"; missing: string[] };

function readEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = (process.env[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function truthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function resolveEximbayEnvMode(): EximbayEnvMode {
  const raw = (process.env.EXIMBAY_ENV ?? "test").trim().toLowerCase();
  return raw === "production" || raw === "live" ? "production" : "test";
}

export function resolveEximbayApiOrigin(mode: EximbayEnvMode = resolveEximbayEnvMode()): string {
  return mode === "production" ? EXIMBAY_API_ORIGIN_LIVE : EXIMBAY_API_ORIGIN_TEST;
}

export function resolveEximbaySdkScriptUrl(mode: EximbayEnvMode = resolveEximbayEnvMode()): string {
  return `${resolveEximbayApiOrigin(mode)}/v2/javascriptSDK.js`;
}

/**
 * Eximbay HTTP Basic — username = API Key, password empty.
 * Encode `apiKey + ":"` then prefix `Basic `.
 * @see https://developer.eximbay.com/eximbay/payment_linkage/preparing-payment.html
 */
export function buildEximbayBasicAuthHeader(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) throw new Error("eximbay_api_key_empty");
  const token = Buffer.from(`${key}:`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export function resolveEximbayEnv(): ResolveEximbayEnvResult {
  const mid = readEnv("EXIMBAY_MID", "eximbay_mid");
  const apiKey = readEnv("EXIMBAY_API_KEY", "eximbay_api_key");
  const missing: string[] = [];
  if (!mid) missing.push("EXIMBAY_MID");
  if (!apiKey) missing.push("EXIMBAY_API_KEY");
  if (missing.length) return { ok: false, reason: "eximbay_env_incomplete", missing };

  const mode = resolveEximbayEnvMode();
  const apiOrigin = resolveEximbayApiOrigin(mode);
  return {
    ok: true,
    env: {
      mid,
      apiKey,
      mode,
      apiOrigin,
      sdkScriptUrl: `${apiOrigin}/v2/javascriptSDK.js`,
    },
  };
}

/** Site base for return_url / status_url. */
export function resolveSimplyurEximbaySiteBaseUrl(): string | null {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    ""
  ).trim();
  if (!base) return null;
  try {
    const u = new URL(base);
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.origin;
  } catch {
    return null;
  }
}

export function resolveSimplyurEximbayStatusUrl(): string | null {
  const origin = resolveSimplyurEximbaySiteBaseUrl();
  if (!origin) return null;
  return `${origin}/api/simplyur/webhooks/eximbay`;
}

export function resolveSimplyurEximbayReturnUrl(locale: string): string | null {
  const origin = resolveSimplyurEximbaySiteBaseUrl();
  if (!origin) return null;
  const loc = (locale || "en").trim() || "en";
  return `${origin}/simplyur/${encodeURIComponent(loc)}/checkout/eximbay-return`;
}

/** Dev-only prep smoke UI (does not replace PortOne checkout). */
export function isSimplyurEximbayPrepUiEnabled(): boolean {
  return (
    truthyEnv(process.env.SIMPLYUR_EXIMBAY_PREP_UI) ||
    truthyEnv(process.env.NEXT_PUBLIC_SIMPLYUR_EXIMBAY_PREP_UI)
  );
}
