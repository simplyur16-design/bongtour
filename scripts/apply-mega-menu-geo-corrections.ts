/**
 * 운영 감사(2026-06) 메가메뉴 geo 수동 정정 일괄 적용.
 * npx tsx scripts/apply-mega-menu-geo-corrections.ts           # dry-run
 * npx tsx scripts/apply-mega-menu-geo-corrections.ts --apply
 */
import { config as loadEnv } from 'dotenv'
import fs from 'fs'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

type CountryTagRow = {
  countryKey: string
  nodeKey?: string | null
  groupKey?: string | null
  isPrimary: boolean
}

type CityTagRow = {
  cityKey: string
  isPrimary?: boolean
}

type Correction = {
  slug: string
  note?: string
  primary: { continentKey: string; countryKey: string; cityKey: string | null }
  countryTags?: CountryTagRow[]
  cityTags?: CityTagRow[]
}

const DEFAULT_DATA_PATH = path.join(
  process.cwd(),
  'scripts/data/mega-menu-geo-corrections-2026-06.json',
)

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]?.trim()
  const DATA_PATH = fileArg
    ? path.isAbsolute(fileArg)
      ? fileArg
      : path.join(process.cwd(), fileArg)
    : DEFAULT_DATA_PATH
  console.log(`[corrections] file=${DATA_PATH}`)
  const raw = fs.readFileSync(DATA_PATH, 'utf8')
  const corrections = JSON.parse(raw) as Correction[]

  const { PrismaClient } = await import('@prisma/client')
  const { validateOverseasGeoFromMaster } = await import('@/lib/validate-overseas-geo-master')
  const { deriveTreeGeoFromMasterPrimary } = await import('@/lib/geo-audit-tree-from-master')
  const { findGroupKeyForCountryKey } = await import('@/lib/overseas-location-tree')

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  let ok = 0
  let skip = 0
  let fail = 0

  for (const c of corrections) {
    const product = await prisma.product.findFirst({
      where: { slug: c.slug },
      select: {
        id: true,
        slug: true,
        title: true,
        registrationStatus: true,
        countryTags: { select: { countryKey: true, nodeKey: true, isPrimary: true } },
        cityTags: { select: { cityKey: true } },
      },
    })

    if (!product) {
      console.warn(`[skip] slug not found: ${c.slug}`)
      skip++
      continue
    }

    const { continentKey, countryKey, cityKey } = c.primary
    const v = await validateOverseasGeoFromMaster(prisma, {
      continentKey,
      countryKey,
      cityKey,
    })
    if (!v.ok) {
      console.error(`[fail] ${c.slug} validation: ${v.reason}`)
      fail++
      continue
    }

    const tree = deriveTreeGeoFromMasterPrimary(countryKey, cityKey)
    const countryTagRows =
      c.countryTags?.map((t, i) => ({
        productId: product.id,
        countryKey: t.countryKey,
        nodeKey: t.nodeKey ?? null,
        groupKey: t.groupKey ?? findGroupKeyForCountryKey(t.countryKey),
        isPrimary: t.isPrimary,
        sortOrder: i,
      })) ?? []

    const cityTagRows =
      c.cityTags?.map((t, i) => ({
        productId: product.id,
        cityKey: t.cityKey,
        isPrimary: t.isPrimary ?? i === 0,
        sortOrder: i,
      })) ?? (cityKey ? [{ productId: product.id, cityKey, isPrimary: true, sortOrder: 0 }] : [])

    const beforeTags = product.countryTags.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ')
    const afterTags = countryTagRows.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ')

    console.log(
      `[${apply ? 'apply' : 'dry'}] ${c.slug} ${c.note ?? ''}\n  before: ${beforeTags || '(none)'}\n  after:  ${afterTags || '(derive sync)'}`,
    )

    if (!apply) {
      ok++
      continue
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: {
          continentKey,
          countryKey,
          cityKey,
          country: v.validated.country.koreanLabel,
          city: v.validated.city?.koreanLabel ?? null,
          groupKey: tree.groupKey,
          nodeKey: tree.nodeKey,
          continent: tree.continent,
          locationMatchConfidence: 'high',
          locationMatchSource: 'mega-menu-geo-corrections:2026-06',
        },
      })

      if (countryTagRows.length > 0) {
        await tx.productCountryTag.deleteMany({ where: { productId: product.id } })
        await tx.productCountryTag.createMany({ data: countryTagRows })
      }

      if (cityTagRows.length > 0) {
        await tx.productCityTag.deleteMany({ where: { productId: product.id } })
        await tx.productCityTag.createMany({ data: cityTagRows })
      }
    })

    ok++
  }

  await prisma.$disconnect()
  console.log(`\nDone: ok=${ok} skip=${skip} fail=${fail} apply=${apply}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
