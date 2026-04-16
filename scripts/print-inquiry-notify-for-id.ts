/**
 * DB에 저장된 문의 1건으로 운영자 이메일 제목·요약 재구성(발송 없음).
 * npx tsx scripts/print-inquiry-notify-for-id.ts <inquiryId>
 */
import './load-env-for-scripts'
import { prisma } from '@/lib/prisma'
import {
  buildInquiryEmailSubject,
  buildInquiryEmailSummaryBlock,
  resolveInquiryAlertPrefix,
  type InquiryNotifyInput,
} from '@/lib/inquiry-notification-format'

process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function main(): Promise<void> {
  const id = process.argv[2]
  if (!id) {
    console.error('usage: npx tsx scripts/print-inquiry-notify-for-id.ts <inquiryId>')
    process.exit(2)
  }
  const row = await prisma.customerInquiry.findUnique({
    where: { id },
    select: {
      id: true,
      inquiryType: true,
      applicantName: true,
      applicantPhone: true,
      applicantEmail: true,
      message: true,
      sourcePagePath: true,
      createdAt: true,
      payloadJson: true,
      productId: true,
      snapshotProductTitle: true,
      snapshotCardLabel: true,
    },
  })
  if (!row) {
    console.error('not found')
    process.exit(1)
  }
  let product: InquiryNotifyInput['product'] = null
  if (row.productId) {
    const p = await prisma.product.findUnique({
      where: { id: row.productId },
      select: { title: true, originCode: true, originSource: true },
    })
    if (p) product = p
  }
  const input: InquiryNotifyInput = {
    inquiryId: row.id,
    inquiryType: row.inquiryType,
    applicantName: row.applicantName,
    applicantPhone: row.applicantPhone,
    applicantEmail: row.applicantEmail,
    message: row.message,
    sourcePagePath: row.sourcePagePath,
    createdAtIso: row.createdAt.toISOString(),
    payloadJson: row.payloadJson,
    productId: row.productId,
    snapshotProductTitle: row.snapshotProductTitle,
    snapshotCardLabel: row.snapshotCardLabel,
    product,
  }
  const prefix = resolveInquiryAlertPrefix(input)
  console.log(
    JSON.stringify(
      {
        prefix,
        emailSubject: buildInquiryEmailSubject(input, prefix),
        emailSummaryTop: buildInquiryEmailSummaryBlock(input, prefix).split('\n').slice(0, 14),
      },
      null,
      2
    )
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
