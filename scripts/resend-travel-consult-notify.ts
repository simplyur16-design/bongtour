/**
 * 최근 travel_consult 1건(또는 지정 id) 관리자·고객 알림 재발송 — 운영 복구용.
 * npx tsx scripts/resend-travel-consult-notify.ts [inquiryId]
 */
import './load-env-for-scripts'
import { prisma } from '@/lib/prisma'
import { notifyTravelConsultInquiryBookingAligned } from '@/lib/inquiry-booking-aligned-notify'
import { summarizeConsultNotificationEnv } from '@/lib/consult-notification-env'

async function main(): Promise<void> {
  const idArg = process.argv[2]?.trim()
  console.log('env:', JSON.stringify(summarizeConsultNotificationEnv(), null, 2))

  const row = idArg
    ? await prisma.customerInquiry.findUnique({ where: { id: idArg } })
    : await prisma.customerInquiry.findFirst({
        where: { inquiryType: 'travel_consult' },
        orderBy: { createdAt: 'desc' },
      })

  if (!row) {
    console.error('travel_consult 문의 없음')
    process.exit(1)
  }

  const productLabel =
    row.snapshotProductTitle?.trim() || row.snapshotCardLabel?.trim() || '상담문의'

  console.log('resend:', row.inquiryNumber, row.applicantName, row.createdAt.toISOString())

  const r = await notifyTravelConsultInquiryBookingAligned(
    {
      id: row.id,
      inquiryNumber: row.inquiryNumber,
      inquiryType: row.inquiryType,
      applicantName: row.applicantName,
      applicantPhone: row.applicantPhone,
      applicantEmail: row.applicantEmail,
      message: row.message,
      payloadJson: row.payloadJson,
      productId: row.productId,
      snapshotProductTitle: row.snapshotProductTitle,
      snapshotCardLabel: row.snapshotCardLabel,
      snapshotOriginSource: row.snapshotOriginSource,
      snapshotOriginUrl: row.snapshotOriginUrl,
      preferredContactChannel: row.preferredContactChannel,
      createdAt: row.createdAt,
    },
    productLabel,
  )

  await prisma.customerInquiry.update({
    where: { id: row.id },
    data: r.emailOk
      ? { emailSentAt: new Date(), emailSentStatus: 'sent', emailError: null }
      : { emailSentStatus: 'failed', emailError: 'resend_script_failed' },
  })

  console.log('result:', JSON.stringify(r, null, 2))
}

main().finally(() => prisma.$disconnect())
