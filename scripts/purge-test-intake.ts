/**
 * 테스트·E2E 상담·예약 접수 목록/삭제 (CLI).
 * npx tsx scripts/purge-test-intake.ts          # 목록
 * npx tsx scripts/purge-test-intake.ts --apply  # 삭제
 */
import './load-env-for-scripts'
import { listTestIntakeCandidates, purgeAllTestIntakes } from '@/lib/purge-test-intake'
import { prisma } from '@/lib/prisma'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const candidates = await listTestIntakeCandidates()
  console.log(`테스트 접수 후보: ${candidates.length}건`)
  for (const c of candidates.slice(0, 30)) {
    console.log(`  [${c.kind}] ${c.accessionNumber} ${c.customerName} (${c.reasons.join(',')})`)
  }
  if (candidates.length > 30) console.log(`  … 외 ${candidates.length - 30}건`)

  if (!apply) {
    console.log('\n삭제하려면: npx tsx scripts/purge-test-intake.ts --apply')
    return
  }

  const r = await purgeAllTestIntakes(false)
  console.log('삭제 완료:', r.deletedInquiries, '문의,', r.deletedBookings, '예약')
}

main().finally(() => prisma.$disconnect())
