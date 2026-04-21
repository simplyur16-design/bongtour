import "server-only";

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveBaseUrlFromEnv(): string {
  const explicit = trimOrEmpty(process.env.USIMSA_BASE_URL);
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  const env = trimOrEmpty(process.env.USIMSA_ENV).toLowerCase() || "development";
  if (env === "production") {
    return "https://open-api.usimsa.com/api";
  }
  return "https://open-api-dev.usimsa.com/api";
}

export type UsimsaConfig = {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  webhookSecret: string;
  webhookUrl: string;
};

/**
 * Validated Usimsa configuration for server-side API calls.
 * Throws if required credentials are missing.
 */
export function getUsimsaConfig(): UsimsaConfig {
  const baseUrl = resolveBaseUrlFromEnv();
  const accessKey = trimOrEmpty(process.env.USIMSA_ACCESS_KEY);
  const secretKey = trimOrEmpty(process.env.USIMSA_SECRET_KEY);

  if (!accessKey) {
    throw new Error(
      "Usimsa: USIMSA_ACCESS_KEY is missing. Set it in the server environment (e.g. .env.local).",
    );
  }
  if (!secretKey) {
    throw new Error(
      "Usimsa: USIMSA_SECRET_KEY is missing. Set it in the server environment (e.g. .env.local).",
    );
  }

  return {
    baseUrl,
    accessKey,
    secretKey,
    webhookSecret: trimOrEmpty(process.env.USIMSA_WEBHOOK_SECRET),
    webhookUrl: trimOrEmpty(process.env.USIMSA_WEBHOOK_URL),
  };
}
