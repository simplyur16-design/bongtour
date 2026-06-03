/**
 * 최근 CustomerInquiry 접수의 이메일 알림 DB 상태 (운영 점검).
 * npx tsx scripts/check-recent-inquiry-notifications.ts [limit]
 */
import './load-env-for-scripts'
import { prisma } from '@/lib/prisma'

async function main(): Promise<void> {
  const limit = Math.min(20, Math.max(1, Number(process.argv[2]) || 8))
  const rows = await prisma.customerInquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      inquiryNumber: true,
      inquiryType: true,
      createdAt: true,
      emailSentStatus: true,
      emailError: true,
      applicantName: true,
      applicantPhone: true,
    },
  })
  console.log(`=== 최근 문의 ${rows.length}건 (이메일 DB 필드만; 관리자 문자는 로그 참고) ===\n`)
  for (const r of rows) {
    const mode = r.inquiryType === 'travel_consult' ? 'booking_aligned' : 'inquiry_legacy'
    console.log(
      [
        r.inquiryNumber,
        r.inquiryType,
        mode,
        `email=${r.emailSentStatus ?? '—'}`,
        r.emailError ? `err=${r.emailError.slice(0, 80)}` : '',
        r.applicantName,
        r.createdAt.toISOString(),
      ]
        .filter(Boolean)
        .join(' | '),
    )
  }
}

main().finally(() => prisma.$disconnect())
