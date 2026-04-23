const DEFAULT_IPS: Record<string, readonly string[]> = {
  production: ["20.39.205.201"],
  development: ["20.196.102.185"],
};

export function getAllowedUsimsaWebhookIps(): string[] {
  const raw = process.env.USIMSA_WEBHOOK_ALLOWED_IPS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  const env = (process.env.USIMSA_ENV?.trim().toLowerCase() || "development");
  const list = DEFAULT_IPS[env] ?? DEFAULT_IPS.development;
  return [...list];
}

export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return null;
}

export function isAllowedUsimsaIp(ip: string | null, allowed: string[]): boolean {
  if (!ip) return false;
  return allowed.includes(ip);
}
