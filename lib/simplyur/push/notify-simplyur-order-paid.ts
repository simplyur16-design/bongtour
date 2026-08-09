/**
 * Best-effort push after simplyur OrderPaid.
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: order-paid push — manifest
 */
import { getPgPool } from '@/lib/bongsim/db/pool'
import { prisma } from '@/lib/prisma'
import { sendSimplyurExpoPushToUser } from '@/lib/simplyur/push/send-expo-push'

export async function notifySimplyurOrderPaidPush(orderId: string): Promise<void> {
  const pool = getPgPool()
  if (!pool) return

  const q = await pool.query<{
    buyer_email: string | null
    order_number: string | null
    consents: unknown
    checkout_channel: string | null
  }>(
    `SELECT buyer_email, order_number, consents, checkout_channel
       FROM bongsim_order
      WHERE order_id = $1::uuid
      LIMIT 1`,
    [orderId],
  )
  const row = q.rows[0]
  if (!row) return
  if (!String(row.checkout_channel ?? '').startsWith('simplyur_')) return

  const consents =
    row.consents && typeof row.consents === 'object'
      ? (row.consents as Record<string, unknown>)
      : {}
  const userIdFromConsent = String(consents.bongtour_user_id ?? '').trim()
  const email = String(row.buyer_email ?? '')
    .trim()
    .toLowerCase()

  let userId = userIdFromConsent
  if (!userId && email.includes('@')) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    userId = u?.id ?? ''
  }
  if (!userId) return

  const orderNo = String(row.order_number ?? '').trim() || orderId.slice(0, 8)
  await sendSimplyurExpoPushToUser(userId, {
    title: 'simplyur — payment confirmed',
    body: `Order ${orderNo}: your eSIM QR is on the way. Open My eSIM when ready.`,
    data: { orderId, type: 'order_paid' },
  })
}
