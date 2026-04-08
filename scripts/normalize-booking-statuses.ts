/**
 * 레거시 Booking.status 문자열을 정규화한다.
 * - 공백만 다른 경우: trim 후 BOOKING_STATUSES 에 맞게 업데이트
 * - --map-unknown-to <상태> 가 있으면 알 수 없는 값을 해당 상태로 일괄 변경 (운영자 확인 후)
 *
 * 사용: npx tsx scripts/normalize-booking-statuses.ts --dry-run
 *       npx tsx scripts/normalize-booking-statuses.ts --apply
 *       npx tsx scripts/normalize-booking-statuses.ts --apply --map-unknown-to 접수완료
 */
import { prisma } from '@/lib/prisma'
import { isBookingStatus, type BookingStatus } from '@/lib/booking-status-policy'

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply')
const mapUnknownIdx = process.argv.indexOf('--map-unknown-to')
const mapUnknownTo: string | null =
  mapUnknownIdx >= 0 && process.argv[mapUnknownIdx + 1]
    ? String(process.argv[mapUnknownIdx + 1]).trim() || null
    : null

async function main() {
  if (mapUnknownTo != null && mapUnknownTo !== '' && !isBookingStatus(mapUnknownTo)) {
    console.error(`[normalize-booking-statuses] invalid --map-unknown-to: ${mapUnknownTo}`)
    process.exitCode = 1
    return
  }

  const rows = await prisma.booking.findMany({
    select: { id: true, status: true },
  })

  let trimUpdates = 0
  let unknownUpdates = 0
  const unknownSamples: string[] = []

  for (const r of rows) {
    const raw = r.status
    const trimmed = raw.trim()

    if (isBookingStatus(trimmed) && trimmed !== raw) {
      trimUpdates++
      if (!dryRun) {
        await prisma.booking.update({
          where: { id: r.id },
          data: { status: trimmed },
        })
      }
      continue
    }

    if (!isBookingStatus(trimmed)) {
      if (!unknownSamples.includes(raw)) unknownSamples.push(raw)
      if (mapUnknownTo) {
        unknownUpdates++
        if (!dryRun) {
          await prisma.booking.update({
            where: { id: r.id },
            data: { status: mapUnknownTo as BookingStatus },
          })
        }
      }
    }
  }

  console.log(
    `[normalize-booking-statuses] mode=${dryRun ? 'dry-run' : 'apply'} trimFixCount=${trimUpdates} unknownMappedCount=${unknownUpdates} mapUnknownTo=${mapUnknownTo ?? '(none)'}`
  )
  if (unknownSamples.length > 0) {
    console.log('[normalize-booking-statuses] unknown status samples:', unknownSamples.slice(0, 20))
  }
  if (!mapUnknownTo && unknownSamples.some((s) => !isBookingStatus(s.trim()))) {
    console.log(
      '[normalize-booking-statuses] hint: run with --apply --map-unknown-to 접수완료 after reviewing samples'
    )
    process.exitCode = 2
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
