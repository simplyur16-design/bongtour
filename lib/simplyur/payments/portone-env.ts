// REGRESSION-FREEZE[simplyur-portone-checkout-p2]: PortOne env SSOT (simplyur only) — manifest

export type PortoneEnv = {
  storeId: string;
  channelKey: string;
  apiSecret: string;
  isTestChannel: boolean;
};

export type ResolvePortoneEnvResult =
  | { ok: true; env: PortoneEnv }
  | { ok: false; reason: "portone_env_incomplete"; missing: string[] };

function truthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function resolvePortoneEnv(): ResolvePortoneEnvResult {
  const storeId = (process.env.PORTONE_STORE_ID ?? "").trim();
  const channelKey = (process.env.PORTONE_CHANNEL_KEY ?? "").trim();
  const apiSecret = (process.env.PORTONE_API_SECRET ?? "").trim();
  const missing: string[] = [];
  if (!storeId) missing.push("PORTONE_STORE_ID");
  if (!channelKey) missing.push("PORTONE_CHANNEL_KEY");
  if (!apiSecret) missing.push("PORTONE_API_SECRET");
  if (missing.length) return { ok: false, reason: "portone_env_incomplete", missing };

  const envRaw = (process.env.PORTONE_ENV ?? "test").trim().toLowerCase();
  const isTestChannel = envRaw !== "production" || truthyEnv(process.env.PORTONE_TEST_CHANNEL);

  return {
    ok: true,
    env: { storeId, channelKey, apiSecret, isTestChannel },
  };
}

export const PORTONE_API_ORIGIN = "https://api.portone.io" as const;
