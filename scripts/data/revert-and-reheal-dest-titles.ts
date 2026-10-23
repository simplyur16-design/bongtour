/**
 * 잘못된 heal 롤백 + dest 재교정 (Plan B title 복원, 국제거리/롯카테이 ≠ 도시).
 * railway run --service bongtour -- npx tsx scripts/data/revert-and-reheal-dest-titles.ts --apply
 */
import '../load-env-for-scripts'
import { existsSync, readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { healRegisterDestinationLabel } from '../../lib/register-destination-finalize'
import { isRegisterDestinationScheduleActivityToken } from '../../lib/register-destination-schedule-activity-noise'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

/** heal이 short로 덮어쓴 확정 건 — before title 강제 복원 */
const TITLE_REVERT: Record<string, string> = {
  '2AZZ4278': '홍콩 실속',
  'JPP4044-261021TW': '동경/하코네/야마나시 온천 4일_[팁포함+자유식비 제공]',
  'APK2502606067CA': '보홀 6일#펀다이빙 #발리카삭 #레이트체크아웃 #라메디리조트',
}

function isBadPlace(s: string | null | undefined): boolean {
  const t = String(s || '').trim()
  if (!t) return true
  if (isRegisterDestinationScheduleActivityToken(t)) return true
  if (/국제\s*거리|노렌\s*거리|롯카테이|스위트피아|가든|주조|공장|식비|실속|금까|사이클링|해안선|덴마구|캄파나/i.test(t)) {
    return true
  }
  if (/^여행$/.test(t)) return true
  if (/거리$/u.test(t) && t.length >= 4) return true
  return false
}

async function main() {
  // JSON 있으면 title revert 보강
  const jsonPath = 'scripts/data/_heal-registered-polluted-dest-covers.json'
  if (existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
        plans?: { originCode: string; before: { title: string }; reason: string[] }[]
      }
      for (const plan of raw.plans ?? []) {
        if (plan.reason?.includes('title') && plan.before?.title) {
          TITLE_REVERT[plan.originCode] = plan.before.title
        }
      }
    } catch {
      /* ignore */
    }
  }

  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [
        { originCode: { in: Object.keys(TITLE_REVERT) } },
        { primaryDestination: { contains: '국제거리' } },
        { primaryDestination: { contains: '롯카테이' } },
        { primaryDestination: { contains: '스위트피아' } },
        { primaryDestination: { contains: '식비' } },
        { primaryDestination: { contains: '캄파나' } },
        { destination: { contains: '국제거리' } },
        { destination: { contains: '롯카테이' } },
        { title: { equals: '홍콩 2박 3일' } },
        { title: { equals: '동경 3박 4일' } },
        { title: { equals: '보홀 4박 6일' } },
        { title: { startsWith: '여행 ' } },
      ],
    },
    select: {
      id: true,
      originCode: true,
      title: true,
      primaryDestination: true,
      destination: true,
      destinationRaw: true,
      countryKey: true,
    },
    take: 500,
  })

  const updates: { id: string; originCode: string; data: Record<string, string | null> }[] = []

  for (const row of rows) {
    const data: Record<string, string | null> = {}
    const revertTitle = TITLE_REVERT[row.originCode]
    if (revertTitle && row.title !== revertTitle) {
      data.title = revertTitle
    } else if (/^\S+\s+\d+박\s*\d+일$/.test(row.title.trim()) && revertTitle) {
      data.title = revertTitle
    }

    const titleForPlace = data.title ?? row.title
    const good = healRegisterDestinationLabel({
      title: titleForPlace,
      countryKey: row.countryKey,
      current: null,
    })

    if (good && (isBadPlace(row.primaryDestination) || isBadPlace(row.destination))) {
      data.primaryDestination = good
      data.destination = good
      data.destinationRaw = good
    } else if (
      good &&
      String(row.destinationRaw || '').split(/[,，]/).length >= 5 &&
      /국제거리|츄라우미|수족관|가든|위스키|번지/i.test(String(row.destinationRaw))
    ) {
      data.destinationRaw = good
      if (isBadPlace(row.primaryDestination)) {
        data.primaryDestination = good
        data.destination = good
      }
    }

    if (Object.keys(data).length === 0) continue
    updates.push({ id: row.id, originCode: row.originCode, data })
  }

  console.log(JSON.stringify({ apply: APPLY, n: updates.length, sample: updates.slice(0, 30) }, null, 2))

  if (!APPLY) return
  for (const u of updates) {
    await prisma.product.update({ where: { id: u.id }, data: u.data })
  }
  console.log(`updated=${updates.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
