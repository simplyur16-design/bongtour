/**
 * 동일 Next 프로세스 내 cron → API self-fetch 시 공개 URL(CDN) 경유 금지.
 * @see docs/ops/production-stability-root-cause.md
 */
export function getInternalLoopbackOrigin(): string {
  const override = process.env.INTERNAL_LOOPBACK_ORIGIN?.trim()
  if (override) return override.replace(/\/$/, '')
  const port = process.env.PORT?.trim() || '3000'
  return `http://127.0.0.1:${port}`
}
