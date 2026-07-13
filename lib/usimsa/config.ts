import "server-only";

import { resolveSecretKey as resolveSecretKeyInner } from "@/lib/usimsa/resolve-secret-key";

// REGRESSION-FREEZE[usimsa-access-key-env-split]: production → USIMSA_PROD_ACCESS_KEY fallback — manifest

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

export type UsimsaRuntimeEnv = "development" | "production";

export type { UsimsaSecretKeyResolution } from "@/lib/usimsa/resolve-secret-key";

/** 시크릿 분기 — 구현은 `lib/usimsa/resolve-secret-key.ts`. */
export function resolveSecretKey(runtimeEnv: UsimsaRuntimeEnv) {
  return resolveSecretKeyInner(runtimeEnv);
}

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

/** x-gat-access-key — `USIMSA_ACCESS_KEY` 레거시 우선, 없으면 ENV별 DEV/PROD */
function resolveAccessKey(runtimeEnv: UsimsaRuntimeEnv): string {
  const legacy = trimOrEmpty(process.env.USIMSA_ACCESS_KEY);
  if (legacy) return legacy;
  if (runtimeEnv === "development") {
    return trimOrEmpty(process.env.USIMSA_DEV_ACCESS_KEY);
  }
  return trimOrEmpty(process.env.USIMSA_PROD_ACCESS_KEY);
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

/** 운영 Partner API 호스트 (취소 등 dev URL 금지 경로용) */
export const USIMSA_PRODUCTION_API_BASE = "https://open-api.usimsa.com/api";

/**
 * Validated Usimsa configuration for server-side API calls.
 * Throws if required credentials are missing.
 *
 * - 액세스 키: `USIMSA_ACCESS_KEY` (없으면 development만 `USIMSA_DEV_ACCESS_KEY`)
 * - 시크릿: `USIMSA_SECRET_KEY` 우선 → 없을 때만 `USIMSA_PROD_SECRET_KEY` / `USIMSA_DEV_SECRET_KEY`
 */
export function getUsimsaConfig(): UsimsaConfig {
  const env = resolveRuntimeEnv();
  const baseUrl = resolveBaseUrlFromEnv();
  const accessKey = resolveAccessKey(env);

  if (!accessKey) {
    throw new Error(
      "Usimsa: USIMSA_ACCESS_KEY is missing (or USIMSA_PROD_ACCESS_KEY / USIMSA_DEV_ACCESS_KEY by USIMSA_ENV). Add it in the server environment (e.g. Railway / .env.local).",
    );
  }

  const { secretKey } = resolveSecretKeyInner(env);

  return {
    env,
    baseUrl,
    accessKey,
    secretKey,
    webhookSecret: trimOrEmpty(process.env.USIMSA_WEBHOOK_SECRET),
    webhookUrl: trimOrEmpty(process.env.USIMSA_WEBHOOK_URL),
  };
}

/**
 * `getUsimsaConfig()`와 동일 access·secret; 호스트만 운영 API로 고정 (취소 POST /v2/cancel/…).
 */
export function getUsimsaConfigWithProductionHost(): UsimsaConfig {
  const cfg = getUsimsaConfig();
  return { ...cfg, baseUrl: USIMSA_PRODUCTION_API_BASE, env: "production" };
}
