/**
 * Simplyur 외국인 eSIM — Eximbay PG env / Basic Auth / base URL SSOT.
 * 봉투어 웰컴페이먼츠와 분리.
 * REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: Eximbay env + Basic Auth — manifest
 */

export const EXIMBAY_API_ORIGIN_TEST = "https://api-test.eximbay.com" as const;
export const EXIMBAY_API_ORIGIN_LIVE = "https://api.eximbay.com" as const;

/**
 * Eximbay 개발자 문서 공개 테스트 키 — 가맹 승인 전 결제창 연동용.
 * @see https://developer.eximbay.com/eximbay/payment_linkage/preparing-payment.html
 */
export const EXIMBAY_PUBLIC_TEST_MID = "1849705C64" as const;
export const EXIMBAY_PUBLIC_TEST_API_KEY = "test_1849705C642C217E0B2D" as const;

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
  let mid = readEnv("EXIMBAY_MID", "eximbay_mid");
  let apiKey = readEnv("EXIMBAY_API_KEY", "eximbay_api_key");
  let mode = resolveEximbayEnvMode();

  // 가맹 승인 전: 문서 공개 테스트 MID/Key 로 결제창 연동 가능. production 강제 시에는 실키 필수.
  if ((!mid || !apiKey) && mode !== "production") {
    mid = mid || EXIMBAY_PUBLIC_TEST_MID;
    apiKey = apiKey || EXIMBAY_PUBLIC_TEST_API_KEY;
    mode = "test";
  }

  const missing: string[] = [];
  if (!mid) missing.push("EXIMBAY_MID");
  if (!apiKey) missing.push("EXIMBAY_API_KEY");
  if (missing.length) return { ok: false, reason: "eximbay_env_incomplete", missing };

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

/** Dev-only prep smoke UI (does not replace live checkout). */
export function isSimplyurEximbayPrepUiEnabled(): boolean {
  return (
    truthyEnv(process.env.SIMPLYUR_EXIMBAY_PREP_UI) ||
    truthyEnv(process.env.NEXT_PUBLIC_SIMPLYUR_EXIMBAY_PREP_UI)
  );
}

/** Simplyur live PG is Eximbay only — PortOne is not used on checkout. */
export function isSimplyurEximbayLiveEnabled(): boolean {
  return resolveEximbayEnv().ok;
}
