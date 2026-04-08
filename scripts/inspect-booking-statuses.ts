/**
 * DB에 저장된 Booking.status 값 분포를 조회한다.
 * lib/booking-status-policy.ts 의 BOOKING_STATUSES 와 다른 문자열이 있으면 표시한다.
 */
import { prisma } from '@/lib/prisma'
import { BOOKING_STATUSES, isBookingStatus } from '@/lib/booking-status-policy'

async function main() {
  const rows = await prisma.booking.groupBy({
    by: ['status'],
    _count: { status: true },
    orderBy: { status: 'asc' },
  })

  const known = BOOKING_STATUSES as readonly string[]
  const lines: string[] = []
  let unknownTotal = 0

  for (const r of rows) {
    const c = r._count.status
    const ok = isBookingStatus(r.status)
    if (!ok) unknownTotal += c
    lines.push(`${ok ? '✓' : '✗'} ${JSON.stringify(r.status)} : ${c}`)
  }

  console.log('[inspect-booking-statuses] distinct status values:')
  for (const l of lines) console.log(' ', l)
  console.log(
    `[inspect-booking-statuses] summary: ${rows.length} distinct, unknownTotal=${unknownTotal}, expected=${known.join(', ')}`
  )

  if (unknownTotal > 0) {
    process.exitCode = 2
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
