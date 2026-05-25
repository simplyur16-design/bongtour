/**
 * 패키지 예약 알림(Solapi) 운영 env 점검 — 비밀값은 출력하지 않음.
 * npx tsx scripts/verify-booking-notification-env.ts
 * (선택) 최근 예약 notificationStatus: DATABASE_URL 필요
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { parseSolapiReceiverPhones } from '@/lib/notification-service'

function flag(name: string): 'set' | 'empty' {
  const v = process.env[name]?.trim()
  return v ? 'set' : 'empty'
}

async function main() {
  const adminRecipients = parseSolapiReceiverPhones()
  const solapiCore =
    flag('SOLAPI_API_KEY') === 'set' &&
    flag('SOLAPI_API_SECRET') === 'set' &&
    flag('SOLAPI_FROM_PHONE') === 'set'

  const adminSmsReady = solapiCore && adminRecipients.length > 0
  const customerAlimReady =
    solapiCore &&
    flag('SOLAPI_PFID') === 'set' &&
    flag('SOLAPI_TPL_BOOKING_REQUEST_RECEIVED') === 'set'
  const customerLmsFallbackReady = solapiCore

  const legacyAdminPhone = flag('ADMIN_PHONE')
  const usedAdminPhones = flag('SOLAPI_ADMIN_PHONES')

  console.log('=== 패키지 예약 POST /api/bookings 알림 env ===')
  console.log('SMTP (관리자 이메일):', {
    SMTP_HOST: flag('SMTP_HOST'),
    BOOKING_NOTIFICATION_EMAIL: flag('BOOKING_NOTIFICATION_EMAIL'),
    INQUIRY_NOTIFICATION_EMAIL: flag('INQUIRY_NOTIFICATION_EMAIL'),
  })
  console.log('Solapi core:', {
    SOLAPI_API_KEY: flag('SOLAPI_API_KEY'),
    SOLAPI_API_SECRET: flag('SOLAPI_API_SECRET'),
    SOLAPI_FROM_PHONE: flag('SOLAPI_FROM_PHONE'),
  })
  console.log('관리자 문자(LMS):', {
    SOLAPI_ADMIN_PHONES: usedAdminPhones,
    parsedRecipientCount: adminRecipients.length,
    adminSmsWouldSend: adminSmsReady,
    ADMIN_PHONE_legacy_unused: legacyAdminPhone,
  })
  if (legacyAdminPhone === 'set' && usedAdminPhones === 'empty') {
    console.warn(
      '⚠ ADMIN_PHONE 은 코드에서 사용하지 않습니다. SOLAPI_ADMIN_PHONES 에 동일 번호를 넣어야 관리자 문자가 갑니다.',
    )
  }
  console.log('고객 카톡(알림톡):', {
    SOLAPI_PFID: flag('SOLAPI_PFID'),
    SOLAPI_TPL_BOOKING_REQUEST_RECEIVED: flag('SOLAPI_TPL_BOOKING_REQUEST_RECEIVED'),
    customerAlimWouldSend: customerAlimReady,
  })
  console.log('고객 문자(LMS 폴백):', { customerLmsFallbackReady })

  const dbUrl = process.env.DATABASE_URL?.trim()
  if (dbUrl && /^postgres(ql)?:\/\//i.test(dbUrl)) {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    try {
      const rows = await prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          bookingNumber: true,
          createdAt: true,
          productTitle: true,
          notificationStatus: true,
          notificationError: true,
        },
      })
      console.log('\n=== 최근 예약 5건 (알림 발송 상태) ===')
      for (const r of rows) {
        console.log({
          id: r.id,
          bookingNumber: r.bookingNumber,
          at: r.createdAt.toISOString(),
          title: r.productTitle?.slice(0, 40),
          notificationStatus: r.notificationStatus ?? '(null=미발송/스킵)',
          notificationError: r.notificationError?.slice(0, 120) ?? null,
        })
      }
    } catch (e) {
      console.log('\n(DB 조회 실패 — 로컬 DATABASE_URL 이 postgres 가 아니면 생략)', (e as Error).message?.slice(0, 80))
    } finally {
      await prisma.$disconnect()
    }
  } else {
    console.log('\n(DATABASE_URL 없음 또는 postgres 아님 — 최근 예약 DB 조회 생략)')
  }

  if (!adminSmsReady) {
    console.log('\n진단: 이메일만 오고 관리자 카톡/문자가 없다면 → Solapi 관리자 env 미설정 가능성이 큼.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
