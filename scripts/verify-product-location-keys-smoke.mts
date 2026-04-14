/**
 * 상품 위치 키 스모크: DB에 4건 생성 후 countryKey/nodeKey 등 확인하고 삭제.
 * 실행: npx tsx scripts/verify-product-location-keys-smoke.mts
 * (프로젝트 루트 `.env` 에서 DATABASE_URL 한 줄 로드 — dotenv 패키지 없음)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env')
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/)
    if (m) {
      let v = m[1].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env.DATABASE_URL = v
      break
    }
  }
}

import { prisma } from '../lib/prisma'
import { deriveProductLocationKeyFieldsForPrisma } from '../lib/product-location-key-match.ts'

const VERYGOOD_ORIGIN = 'VERYGOODTOUR'

const ts = Date.now()

const cases = [
  {
    label: 'hanatour',
    originSource: '하나투어',
    originCode: `smoke-han-${ts}`,
    title: '[스모크] 다낭 3박4일',
    destination: '다낭',
    destinationRaw: '다낭',
    primaryDestination: '다낭',
    bodyText: '다낭 항공',
  },
  {
    label: 'modetour',
    originSource: '모두투어',
    originCode: `smoke-mode-${ts}`,
    title: '[스모크] 오사카 교토 4일',
    destination: '오사카',
    destinationRaw: '오사카',
    primaryDestination: '오사카',
    bodyText: '간사이',
  },
  {
    label: 'ybtour',
    originSource: '노랑풍선',
    originCode: `smoke-yb-${ts}`,
    title: '[스모크] 방콕 파타야',
    destination: '방콕',
    destinationRaw: '방콕',
    primaryDestination: '방콕',
    bodyText: '태국',
  },
  {
    label: 'verygoodtour',
    originSource: VERYGOOD_ORIGIN,
    originCode: `smoke-vg-${ts}`,
    title: '[스모크] 유럽 서유럽 일주',
    destination: '파리',
    destinationRaw: '파리',
    primaryDestination: '파리',
    bodyText: '프랑스',
  },
] as const

async function main() {
  const ids: string[] = []
  try {
    for (const c of cases) {
      const loc = deriveProductLocationKeyFieldsForPrisma({
        title: c.title,
        originSource: c.originSource,
        destination: c.destination,
        destinationRaw: c.destinationRaw,
        primaryDestination: c.primaryDestination,
        bodyText: c.bodyText,
      })
      const row = await prisma.product.create({
        data: {
          originSource: c.originSource,
          originCode: c.originCode,
          title: c.title,
          destination: c.destination,
          destinationRaw: c.destinationRaw,
          primaryDestination: c.primaryDestination,
          duration: '3박4일',
          ...loc,
        },
      })
      ids.push(row.id)
      const again = await prisma.product.findUnique({
        where: { id: row.id },
        select: {
          countryKey: true,
          nodeKey: true,
          groupKey: true,
          locationMatchConfidence: true,
          locationMatchSource: true,
        },
      })
      console.log(`--- ${c.label} (${c.originSource}) ---`)
      console.log(JSON.stringify(again, null, 2))
    }
    console.log('OK: 4 rows written and read back.')
  } finally {
    if (ids.length) {
      await prisma.product.deleteMany({ where: { id: { in: ids } } })
      console.log('Cleaned up test rows:', ids.length)
    }
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
