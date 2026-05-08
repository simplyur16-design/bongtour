/**
 * x-bongtour-cron-secret ↔ BONGTOUR_CRON_SECRET — instrumentation·외부 스케줄러 공통.
 */
export function getBongtourCronSecret(): string {
  return (process.env.BONGTOUR_CRON_SECRET ?? "").trim();
}

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = getBongtourCronSecret();
  if (!secret) return false;
  const h = req.headers.get("x-bongtour-cron-secret");
  return h === secret;
}
