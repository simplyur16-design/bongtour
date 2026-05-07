/**
 * B-publish: 네이버 블로그 마케팅 글 예약 알림(Solapi LMS) + scheduled→published 자동 전환.
 */
import type { PrismaClient } from '@prisma/client'

import { absoluteUrl } from '@/lib/site-metadata'
import { createSolapiAuthorizationHeader } from '@/lib/solapi-auth'
import { parseSolapiReceiverPhones } from '@/lib/notification-service'

const SOLAPI_SEND_URL = 'https://api.solapi.com/messages/v4/send'
const LMS_TEXT_MAX = 1900

function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function isPlausibleKrSmsTo(digits: string): boolean {
  const n = digits.length
  return n >= 10 && n <= 12
}

/** `SOLAPI_OPERATOR_PHONE` 우선, 없으면 `SOLAPI_ADMIN_PHONES` 첫 번호 */
export function resolveSolapiOperatorRecipient(): string | null {
  const single = process.env.SOLAPI_OPERATOR_PHONE?.trim()
  if (single) {
    const d = digitsOnlyPhone(single)
    if (d && isPlausibleKrSmsTo(d)) return d
  }
  const admins = parseSolapiReceiverPhones()
  return admins[0] ?? null
}

function isPublishReminderDryRun(): boolean {
  const v = (process.env.PUBLISH_REMINDER_DRY_RUN ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

async function sendSolapiLms(toDigits: string, text: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim()
  if (!apiKey || !apiSecret || !senderRaw) {
    return { ok: false, message: 'solapi_credentials_missing' }
  }
  const from = digitsOnlyPhone(senderRaw)
  if (!from || !isPlausibleKrSmsTo(from)) {
    return { ok: false, message: 'solapi_invalid_from_phone' }
  }
  const authHeader = createSolapiAuthorizationHeader(apiKey, apiSecret)
  const bodyText = text.length > LMS_TEXT_MAX ? `${text.slice(0, LMS_TEXT_MAX - 1)}…` : text
  const res = await fetch(SOLAPI_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      message: {
        from,
        to: toDigits,
        text: bodyText,
      },
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    statusCode?: string
    errorCode?: string
    statusMessage?: string
    message?: string
  }
  if (!res.ok) {
    const message = data.statusMessage ?? data.message ?? res.statusText
    return { ok: false, message }
  }
  return { ok: true }
}

function marketingAdminPath(contentTrack: string, id: string): string {
  const track = contentTrack === 'airtel' ? 'airtel' : 'packages'
  return `/admin/marketing/${track}/${id}`
}

function formatScheduledKst(scheduledAt: Date): string {
  return scheduledAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export type PublishReminderTickResult = {
  reminders: {
    candidates: Array<{ id: string; title: string; scheduledAt: Date; contentTrack: string }>
    sentIds: string[]
    dryRun: boolean
    skippedNoRecipient: boolean
    errors: Array<{ id: string; message: string }>
  }
  transitions: {
    candidates: Array<{ id: string; title: string; scheduledAt: Date | null }>
    transitionedIds: string[]
  }
}

/**
 * 예약 시각이 지금부터 30분 이내인 scheduled 글에 대해 Solapi LMS 1통 + publishReminderSentAt 기록.
 */
export async function sendDailyPublishReminders(prisma: PrismaClient): Promise<PublishReminderTickResult['reminders']> {
  const now = new Date()
  const horizon = new Date(now.getTime() + 30 * 60 * 1000)
  const dryRun = isPublishReminderDryRun()
  const to = resolveSolapiOperatorRecipient()

  const rows = await prisma.bongBlogPost.findMany({
    where: {
      status: 'scheduled',
      publishReminderSentAt: null,
      scheduledAt: { not: null, gte: now, lte: horizon },
    },
    select: { id: true, title: true, scheduledAt: true, contentTrack: true },
    orderBy: { scheduledAt: 'asc' },
  })

  const candidates = rows.map((r) => ({
    id: r.id,
    title: r.title,
    scheduledAt: r.scheduledAt!,
    contentTrack: r.contentTrack,
  }))

  if (!to) {
    return {
      candidates,
      sentIds: [],
      dryRun,
      skippedNoRecipient: true,
      errors: [],
    }
  }

  const sentIds: string[] = []
  const errors: Array<{ id: string; message: string }> = []

  for (const row of rows) {
    const when = row.scheduledAt!
    const adminUrl = absoluteUrl(marketingAdminPath(row.contentTrack, row.id))
    const text = [
      `[봉투어 마케팅] ${formatScheduledKst(when)} 게시 예정`,
      `- ${row.contentTrack}: ${row.title}`,
      `어드민: ${adminUrl}`,
    ].join('\n')

    if (dryRun) {
      console.log('[publish-reminder] dry_run would_send', row.id, JSON.stringify({ to, textPreview: text.slice(0, 120) }))
      continue
    }

    const r = await sendSolapiLms(to, text)
    if (!r.ok) {
      errors.push({ id: row.id, message: r.message })
      continue
    }
    await prisma.bongBlogPost.update({
      where: { id: row.id },
      data: { publishReminderSentAt: new Date() },
    })
    sentIds.push(row.id)
  }

  return { candidates, sentIds, dryRun, skippedNoRecipient: false, errors }
}

/**
 * 예약 시각이 지난 scheduled 글을 published 로 올리고 publishedAt=scheduledAt (URL 등은 비움 유지).
 */
export async function transitionScheduledToPublished(
  prisma: PrismaClient,
): Promise<PublishReminderTickResult['transitions']> {
  const now = new Date()
  const due = await prisma.bongBlogPost.findMany({
    where: {
      status: 'scheduled',
      publishedAt: null,
      scheduledAt: { not: null, lte: now },
    },
    select: { id: true, title: true, scheduledAt: true },
    orderBy: { scheduledAt: 'asc' },
  })

  const candidates = due.map((r) => ({
    id: r.id,
    title: r.title,
    scheduledAt: r.scheduledAt,
  }))

  const transitionedIds: string[] = []
  for (const row of due) {
    const at = row.scheduledAt!
    await prisma.bongBlogPost.update({
      where: { id: row.id },
      data: {
        status: 'published',
        publishedAt: at,
      },
    })
    transitionedIds.push(row.id)
  }

  return { candidates, transitionedIds }
}

export async function runPublishReminderTick(prisma: PrismaClient): Promise<PublishReminderTickResult> {
  const transitions = await transitionScheduledToPublished(prisma)
  const reminders = await sendDailyPublishReminders(prisma)
  return { reminders, transitions }
}
