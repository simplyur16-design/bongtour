export type SecurityAnomalyPayload = {
  ip: string
  path: string
  unauthorized: number
  forbidden: number
  limited: number
  expensive: number
}

type EnvStage = 'dev' | 'staging' | 'prod'
type GlobalNotifier = typeof globalThis & {
  __bongtourSecurityNotifierDedupe?: Map<string, number>
}

function getStage(): EnvStage {
  const raw = (process.env.APP_ENV || process.env.NODE_ENV || 'dev').toLowerCase()
  if (raw.includes('prod')) return 'prod'
  if (raw.includes('stag')) return 'staging'
  return 'dev'
}

function shouldSend(stage: EnvStage): { webhook: boolean; slack: boolean; email: boolean } {
  if (stage === 'prod') return { webhook: true, slack: true, email: true }
  if (stage === 'staging') return { webhook: true, slack: true, email: false }
  return { webhook: true, slack: false, email: false }
}

function dedupeKey(payload: SecurityAnomalyPayload): string {
  return `${payload.ip}|${payload.path}|${payload.unauthorized}|${payload.forbidden}|${payload.limited}|${payload.expensive}`
}

function shouldDedupe(payload: SecurityAnomalyPayload): boolean {
  const cooldownMs = Math.max(60_000, Number(process.env.SECURITY_ALERT_COOLDOWN_MS ?? 300_000) || 300_000)
  const now = Date.now()
  const g = globalThis as GlobalNotifier
  if (!g.__bongtourSecurityNotifierDedupe) g.__bongtourSecurityNotifierDedupe = new Map()
  const key = dedupeKey(payload)
  const prev = g.__bongtourSecurityNotifierDedupe.get(key) ?? 0
  if (now - prev < cooldownMs) return true
  g.__bongtourSecurityNotifierDedupe.set(key, now)
  return false
}

async function postJson(url: string, body: Record<string, unknown>) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
}

/**
 * 외부 채널 연동 확장 포인트.
 * - webhook/slack/email 분리
 * - 환경별 정책(dev/staging/prod)
 * - dedupe/cooldown 적용
 */
export async function notifySecurityAnomaly(payload: SecurityAnomalyPayload) {
  if (shouldDedupe(payload)) return
  const stage = getStage()
  const policy = shouldSend(stage)
  const baseBody = {
    text: '[BONGTOUR] admin-api-security-anomaly',
    stage,
    ...payload,
  }
  try {
    if (policy.webhook && process.env.SECURITY_ALERT_WEBHOOK_URL) {
      await postJson(process.env.SECURITY_ALERT_WEBHOOK_URL, baseBody)
    }
    if (policy.slack && process.env.SECURITY_ALERT_SLACK_WEBHOOK_URL) {
      await postJson(process.env.SECURITY_ALERT_SLACK_WEBHOOK_URL, {
        text: `[BONGTOUR][${stage}] admin-api-security-anomaly\nip=${payload.ip}\npath=${payload.path}\n401=${payload.unauthorized},403=${payload.forbidden},429=${payload.limited},expensive=${payload.expensive}`,
      })
    }
    if (policy.email && process.env.SECURITY_ALERT_EMAIL_WEBHOOK_URL) {
      await postJson(process.env.SECURITY_ALERT_EMAIL_WEBHOOK_URL, {
        subject: `[BONGTOUR][${stage}] admin-api-security-anomaly`,
        body: JSON.stringify(baseBody),
      })
    }
  } catch (e) {
    console.error('[security-anomaly-notifier] webhook failed', e)
  }
}
