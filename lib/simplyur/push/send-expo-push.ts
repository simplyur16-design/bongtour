/**
 * Best-effort Expo push (requires EXPO_ACCESS_TOKEN).
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: expo push send — manifest
 */
import { prisma } from '@/lib/prisma'

export type SimplyurPushMessage = {
  title: string
  body: string
  data?: Record<string, string>
}

export async function sendSimplyurExpoPushToUser(
  userId: string,
  message: SimplyurPushMessage,
): Promise<{ sent: number; skipped: string }> {
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim()
  if (!accessToken) return { sent: 0, skipped: 'expo_access_token_missing' }

  const id = userId.trim()
  if (!id) return { sent: 0, skipped: 'no_user' }

  const rows = await prisma.simplyurDevicePushToken.findMany({
    where: { userId: id },
    select: { token: true },
    take: 20,
  })
  if (rows.length === 0) return { sent: 0, skipped: 'no_tokens' }

  const messages = rows.map((r) => ({
    to: r.token,
    sound: 'default' as const,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  }))

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messages),
    })
    if (!res.ok) return { sent: 0, skipped: `expo_http_${res.status}` }
    return { sent: messages.length, skipped: '' }
  } catch {
    return { sent: 0, skipped: 'network' }
  }
}
