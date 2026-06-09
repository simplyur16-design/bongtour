/**
 * 유럽 메가메뉴 중분류(menuGroup) 정합 감사 — 서유럽·동유럽 등 LC leaf SSOT vs 상품 태그·레거시 매핑.
 * npx tsx scripts/audit-europe-menu-group-classification.ts
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { countrySlugFromLabel } from '@/lib/location-url-slugs'
import {
  resolveMegaMenuGroupCountryKeySlugs,
  resolveMegaMenuMenuGroupSlugToCountryKeySlugs,
} from '@/lib/mega-menu-browse-group'
import { buildOverseasBrowseGeoResolution } from '@/lib/browse-master-geo'
import {
  resolveBrowseCountryParamToCountryKeySlugs,
  resolveBrowseCountryParamToDbCountries,
} from '@/lib/browse-country-url-resolve'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

const EUROPE_TAB_ID = 'europe-me'

/** 메가메뉴 LC leaf SSOT — countryKey → 중분류 menuGroup 슬러그 */
function buildMegaMenuEuropeCountryToMenuGroup(): Map<string, string> {
  const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === EUROPE_TAB_ID)
  const out = new Map<string, string>()
  if (!tab) return out
  for (const g of tab.groups) {
    const menuGroup = countrySlugFromLabel(g.countryLabel)
    for (const leaf of g.cities) {
      if (leaf.kind !== 'country') continue
      const slug = countrySlugFromLabel(leaf.browseCountryLabel ?? leaf.label)
      for (const term of [slug, ...leaf.terms.map((t) => countrySlugFromLabel(t))]) {
        for (const ck of resolveBrowseCountryParamToCountryKeySlugs(term)) {
          if (/^[a-z0-9-]+$/.test(ck) && !['western-europe', 'eastern-europe', 'northern-europe', 'southern-europe', 'balkans'].includes(ck)) {
            out.set(ck, menuGroup)
          }
        }
      }
    }
  }
  return out
}

function menuGroupLabel(slug: string): string {
  const tab = MEGA_MENU_TAB_DEFINITIONS.find((t) => t.id === EUROPE_TAB_ID)
  const g = tab?.groups.find((x) => countrySlugFromLabel(x.countryLabel) === slug)
  return g?.countryLabel ?? slug
}

async function productMatchesMenuGroup(
  productId: string,
  menuGroup: string,
): Promise<boolean> {
  const geo = await buildOverseasBrowseGeoResolution({
    region: EUROPE_TAB_ID,
    country: null,
    city: null,
    menuGroup,
  })
  const n = await prisma.product.count({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: geo.whereClauses,
    },
  })
  return n > 0
}

async function main() {
  const countryToMenuGroup = buildMegaMenuEuropeCountryToMenuGroup()

  console.log('=== 메가메뉴 유럽 중분류 SSOT (LC country → menuGroup) ===\n')
  const byGroup = new Map<string, string[]>()
  for (const [ck, mg] of [...countryToMenuGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const list = byGroup.get(mg) ?? []
    list.push(ck)
    byGroup.set(mg, list)
  }
  for (const [mg, keys] of [...byGroup.entries()].sort()) {
    console.log(`${menuGroupLabel(mg)} (${mg}): ${keys.join(', ')}`)
  }

  console.log('\n=== menuGroup countryKey 합집합 (browse 필터) ===\n')
  const menuGroups = [
    'western-europe',
    'eastern-europe',
    'northern-europe',
    'spain-portugal',
    'greece',
    'turkey',
    'caucasus',
  ]
  const groupKeys = new Map<string, string[]>()
  for (const mg of menuGroups) {
    const keys = resolveMegaMenuGroupCountryKeySlugs(EUROPE_TAB_ID, mg)
    groupKeys.set(mg, keys)
    console.log(`${menuGroupLabel(mg)}: [${keys.join(', ')}]`)
  }

  console.log('\n=== 레거시 BROWSE 슬러그 → DB 한글 라벨 (유럽·불일치 후보) ===\n')
  const legacyChecks: Array<{ slug: string; expectMenuGroup: string; note?: string }> = [
    { slug: 'austria', expectMenuGroup: 'western-europe', note: '메가메뉴 서유럽 LC' },
    { slug: 'germany', expectMenuGroup: 'western-europe' },
    { slug: 'netherlands', expectMenuGroup: 'western-europe' },
    { slug: 'belgium', expectMenuGroup: 'western-europe' },
    { slug: 'czech', expectMenuGroup: 'eastern-europe' },
    { slug: 'hungary', expectMenuGroup: 'eastern-europe' },
    { slug: 'poland', expectMenuGroup: 'eastern-europe' },
    { slug: 'croatia', expectMenuGroup: 'eastern-europe' },
    { slug: 'slovenia', expectMenuGroup: 'eastern-europe' },
    { slug: 'western-europe', expectMenuGroup: 'western-europe' },
    { slug: 'eastern-europe', expectMenuGroup: 'eastern-europe' },
  ]
  const legacyIssues: string[] = []
  for (const { slug, expectMenuGroup, note } of legacyChecks) {
    const dbKr = resolveBrowseCountryParamToDbCountries(slug)
    const inExpected = (groupKeys.get(expectMenuGroup) ?? []).includes(slug)
    const wrongGroups: string[] = []
    for (const [mg, keys] of groupKeys) {
      if (mg === expectMenuGroup) continue
      if (keys.includes(slug)) wrongGroups.push(mg)
    }
    const flag =
      !inExpected || wrongGroups.length > 0 || (slug === 'austria' && dbKr.includes('동유럽'))
    if (flag) {
      legacyIssues.push(
        `${slug}: dbKr=${JSON.stringify(dbKr)} inExpected=${inExpected} alsoIn=[${wrongGroups.join(',')}] ${note ?? ''}`,
      )
    }
  }
  if (legacyIssues.length) {
    console.log('불일치:')
    for (const x of legacyIssues) console.log(`  - ${x}`)
  } else {
    console.log('(레거시 슬러그 샘플 — 이상 없음)')
  }

  console.log('\n=== 등록 상품 — 유럽 countryTag vs 중분류 노출 ===\n')
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      continentKey: 'europe',
    },
    select: {
      id: true,
      slug: true,
      title: true,
      listingKind: true,
      countryKey: true,
      countryTags: { select: { countryKey: true, isPrimary: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })

  type Row = {
    slug: string
    title: string
    primary: string | null
    tags: string[]
    expectedGroups: Set<string>
    visibleIn: string[]
    missingFrom: string[]
    wrongVisible: string[]
  }

  const rows: Row[] = []
  for (const p of products) {
    const tags = p.countryTags.map((t) => t.countryKey)
    const primary = p.countryTags.find((t) => t.isPrimary)?.countryKey ?? p.countryKey ?? tags[0] ?? null
    const expectedGroups = new Set<string>()
    for (const ck of tags) {
      const mg = countryToMenuGroup.get(ck)
      if (mg) expectedGroups.add(mg)
    }

    const visibleIn: string[] = []
    for (const mg of menuGroups) {
      if (await productMatchesMenuGroup(p.id, mg)) visibleIn.push(mg)
    }

    const missingFrom = [...expectedGroups].filter((mg) => !visibleIn.includes(mg))
    const wrongVisible = visibleIn.filter((mg) => !expectedGroups.has(mg) && expectedGroups.size > 0)

    if (missingFrom.length > 0 || wrongVisible.length > 0) {
      rows.push({
        slug: p.slug ?? p.id,
        title: p.title.slice(0, 60),
        primary,
        tags,
        expectedGroups,
        visibleIn,
        missingFrom,
        wrongVisible,
      })
    }
  }

  const byWrong = rows.filter((r) => r.wrongVisible.length > 0)
  const byMissing = rows.filter((r) => r.missingFrom.length > 0)

  console.log(`검사 상품: ${products.length} (continentKey=europe, registered)`)
  console.log(`중분류 노출 불일치: ${rows.length} (잘못 노출 ${byWrong.length}, 누락 ${byMissing.length})\n`)

  if (byWrong.length) {
    console.log('--- 기대 중분류 밖에서 노출 (오분류 후보) ---')
    for (const r of byWrong.slice(0, 40)) {
      console.log(
        `${r.slug} | primary=${r.primary} | tags=[${r.tags.join(',')}] | expect=[${[...r.expectedGroups].map(menuGroupLabel).join(',')}] | wrong=[${r.wrongVisible.map(menuGroupLabel).join(',')}] | ${r.title}`,
      )
    }
    if (byWrong.length > 40) console.log(`  ... 외 ${byWrong.length - 40}건`)
  }

  if (byMissing.length) {
    console.log('\n--- 기대 중분류에 미노출 (누락 후보) ---')
    for (const r of byMissing.slice(0, 40)) {
      console.log(
        `${r.slug} | primary=${r.primary} | tags=[${r.tags.join(',')}] | missing=[${r.missingFrom.map(menuGroupLabel).join(',')}] | visible=[${r.visibleIn.map(menuGroupLabel).join(',')}] | ${r.title}`,
      )
    }
    if (byMissing.length > 40) console.log(`  ... 외 ${byMissing.length - 40}건`)
  }

  console.log('\n=== 서유럽·동유럽 경계 — 오스트리아 primary + 동유럽 제목 ===\n')
  const border = products.filter(
    (p) =>
      /동유럽|발칸|체코|헝가리|프라하|부다페스트|czech|hungary|prague|budapest/i.test(p.title) &&
      (p.countryTags.some((t) => t.isPrimary && t.countryKey === 'austria') ||
        p.countryKey === 'austria'),
  )
  for (const p of border.slice(0, 20)) {
    const tags = p.countryTags.map((t) => `${t.countryKey}${t.isPrimary ? '*' : ''}`).join(',')
    const inEast = await productMatchesMenuGroup(p.id, 'eastern-europe')
    const inWest = await productMatchesMenuGroup(p.id, 'western-europe')
    console.log(
      `${p.slug} | tags=${tags} | 동유럽=${inEast} 서유럽=${inWest} | ${p.title.slice(0, 70)}`,
    )
  }
  if (border.length > 20) console.log(`  ... 외 ${border.length - 20}건`)

  console.log('\n=== 독일 primary — 동유럽 노출 여부 ===\n')
  const germanyPrimary = products.filter(
    (p) =>
      p.countryTags.some((t) => t.isPrimary && t.countryKey === 'germany') || p.countryKey === 'germany',
  )
  let germanyInEast = 0
  for (const p of germanyPrimary) {
    if (await productMatchesMenuGroup(p.id, 'eastern-europe')) germanyInEast++
  }
  console.log(`독일 primary 상품 ${germanyPrimary.length}건 중 동유럽 browse 매칭: ${germanyInEast}건`)
  for (const p of germanyPrimary.filter(async () => false).slice(0, 0)) {
    /* noop */
  }
  for (const p of germanyPrimary.slice(0, 15)) {
    const inEast = await productMatchesMenuGroup(p.id, 'eastern-europe')
    const inWest = await productMatchesMenuGroup(p.id, 'western-europe')
    if (inEast) {
      const tags = p.countryTags.map((t) => t.countryKey).join(',')
      console.log(`  ${p.slug} 동유럽=${inEast} 서유럽=${inWest} tags=[${tags}] ${p.title.slice(0, 50)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
