/**
 * registered 상품 geo 태그 점검 — 다국가 누락·nodeKey 불일치·제목 오매칭 후보.
 * npx tsx scripts/audit-mega-menu-product-geo.ts
 * npx tsx scripts/audit-mega-menu-product-geo.ts --slug=fit-mt-0040
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

async function main(): Promise<void> {
  const slugFilter = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1]?.trim()

  const { PrismaClient } = await import('@prisma/client')
  const { declaredCountryCountFromTitle, detectMultiCountryAutoPlan } = await import(
    '@/lib/normalize-product-geo-master'
  )
  const { defaultNodeKeyForMasterCountryTag } = await import('@/lib/default-node-key-for-country-tag')
  const { buildMultiCountryDetectionHaystack } = await import('@/lib/geo-haystack-match')
  const { matchProductToOverseasNode } = await import('@/lib/match-overseas-product')

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      ...(slugFilter ? { slug: slugFilter } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      primaryDestination: true,
      destinationRaw: true,
      countryKey: true,
      countryTags: {
        orderBy: { sortOrder: 'asc' },
        select: { countryKey: true, nodeKey: true, isPrimary: true, groupKey: true },
      },
      cityTags: { select: { cityKey: true, isPrimary: true } },
    },
    orderBy: { slug: 'asc' },
  })

  type Issue = { slug: string; kind: string; detail: string }
  const issues: Issue[] = []

  for (const p of products) {
    const title = p.title?.trim() ?? ''
    const declaredN = declaredCountryCountFromTitle(title)
    const tags = p.countryTags.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ')

    if (declaredN && declaredN >= 2) {
      const plan = await detectMultiCountryAutoPlan(
        prisma,
        {
          title,
          primaryDestination: p.primaryDestination,
          destinationRaw: p.destinationRaw,
        },
        p.countryKey,
      )
      const tagKeys = new Set(p.countryTags.map((t) => t.countryKey))
      if (plan.kind === 'multi') {
        const missing = plan.countryKeys.filter((k) => !tagKeys.has(k))
        if (missing.length > 0) {
          issues.push({
            slug: p.slug ?? p.id,
            kind: 'multi_country_missing',
            detail: `title ${declaredN}국 plan=[${plan.countryKeys.join(',')}] confidence=${plan.confidence} missing=[${missing.join(',')}] tags=${tags}`,
          })
        }
      }
    }

    for (const t of p.countryTags) {
      const expected = defaultNodeKeyForMasterCountryTag(t.countryKey)
      if (expected && t.nodeKey && t.nodeKey !== expected) {
        issues.push({
          slug: p.slug ?? p.id,
          kind: 'nodeKey_mismatch',
          detail: `${t.countryKey}: tag nodeKey=${t.nodeKey} expected=${expected}`,
        })
      }
    }

    const hay = buildMultiCountryDetectionHaystack({
      title,
      primaryDestination: p.primaryDestination,
      destinationRaw: p.destinationRaw,
    })
    const inferred = matchProductToOverseasNode({
      title,
      originSource: '',
      primaryDestination: p.primaryDestination,
      destinationRaw: p.destinationRaw,
    })
    const hasJapanNikko = p.countryTags.some(
      (t) => t.countryKey === 'japan' && (t.nodeKey === 'nikko' || t.nodeKey === '닛코'),
    )
    const guamInHay = /괌|guam/i.test(hay)
    if (hasJapanNikko && guamInHay && !p.countryTags.some((t) => t.countryKey === 'guam')) {
      issues.push({
        slug: p.slug ?? p.id,
        kind: 'suspected_hotel_false_positive',
        detail: `japan/nikko with 괌 in haystack; inferred=${inferred?.countryKey}/${inferred?.leafKey ?? 'null'} tags=${tags}`,
      })
    }
  }

  await prisma.$disconnect()

  const byKind = new Map<string, number>()
  for (const i of issues) {
    byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1)
  }

  console.log(`[audit] products=${products.length} issues=${issues.length}`)
  for (const [k, n] of [...byKind.entries()].sort()) {
    console.log(`  ${k}: ${n}`)
  }
  for (const i of issues) {
    console.log(`\n🔸 ${i.slug} [${i.kind}]\n   ${i.detail}`)
  }

  if (issues.length > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
