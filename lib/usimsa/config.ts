import "server-only";

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

export type UsimsaRuntimeEnv = "development" | "production";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveRuntimeEnv(): UsimsaRuntimeEnv {
  const e = trimOrEmpty(process.env.USIMSA_ENV).toLowerCase() || "production";
  return e === "production" ? "production" : "development";
}

function resolveBaseUrlFromEnv(): string {
  const explicit = trimOrEmpty(process.env.USIMSA_BASE_URL);
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  const env = resolveRuntimeEnv();
  if (env === "production") {
    return "https://open-api.usimsa.com/api";
  }
  return "https://open-api-dev.usimsa.com/api";
}

function resolveAccessKey(runtimeEnv: UsimsaRuntimeEnv): string {
  const legacy = trimOrEmpty(process.env.USIMSA_ACCESS_KEY);
  if (legacy) {
    return legacy;
  }
  if (runtimeEnv === "production") {
    return trimOrEmpty(process.env.USIMSA_PROD_ACCESS_KEY);
  }
  return trimOrEmpty(process.env.USIMSA_DEV_ACCESS_KEY);
}

export type UsimsaConfig = {
  /** `USIMSA_ENV` 기준(미설정 시 production). 베이스 URL·키 분기에 사용. */
  env: UsimsaRuntimeEnv;
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  webhookSecret: string;
  webhookUrl: string;
};

/**
 * Validated Usimsa configuration for server-side API calls.
 * Throws if required credentials are missing.
 *
 * 키 분기:
 * - `USIMSA_ACCESS_KEY`가 비어 있지 않으면 **환경 무관**으로 그 키를 사용(레거시 호환).
 * - 비어 있으면 `USIMSA_ENV=production` → `USIMSA_PROD_ACCESS_KEY`, 아니면 `USIMSA_DEV_ACCESS_KEY`.
 * - 시크릿은 공통 `USIMSA_SECRET_KEY`.
 */
export function getUsimsaConfig(): UsimsaConfig {
  const env = resolveRuntimeEnv();
  const baseUrl = resolveBaseUrlFromEnv();
  const accessKey = resolveAccessKey(env);
  const secretKey = trimOrEmpty(process.env.USIMSA_SECRET_KEY);

  if (!accessKey) {
    if (env === "production") {
      throw new Error(
        "Usimsa: USIMSA_PROD_ACCESS_KEY is missing (or set USIMSA_ACCESS_KEY for legacy). Add it in the server environment (e.g. Railway / .env.local).",
      );
    }
    throw new Error(
      "Usimsa: USIMSA_DEV_ACCESS_KEY is missing (or set USIMSA_ACCESS_KEY for legacy). Add it in the server environment (e.g. .env.local).",
    );
  }

  if (!secretKey) {
    throw new Error(
      "Usimsa: USIMSA_SECRET_KEY is missing. Add it in the server environment (e.g. .env.local).",
    );
  }

  return {
    env,
    baseUrl,
    accessKey,
    secretKey,
    webhookSecret: trimOrEmpty(process.env.USIMSA_WEBHOOK_SECRET),
    webhookUrl: trimOrEmpty(process.env.USIMSA_WEBHOOK_URL),
  };
}
