/**
 * 등록 해외상품 전수 — dest / cityKey / countryKey / 카드 short vs 메가메뉴 leaf.
 *
 *   railway run --service bongtour -- npx tsx scripts/data/_audit-mega-menu-product-alignment.ts
 */
import '../load-env-for-scripts'
import { writeFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import {
  alignDestinationToMegaMenuLeaf,
  classifyMegaMenuDestinationLabel,
  megaMenuLeafBelongsToGroup,
} from '@/lib/align-destination-to-mega-menu-leaf'
import { megaMenuClickLabelForCityKey } from '@/lib/mega-menu-click-label'
import { resolvePublicBrowseCardTitle } from '@/lib/bongtour-product-display-title-ssot'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || process.env.DIRECT_URL,
})

const leafToGroup = new Map<string, string>()
const geoGroupLabels: string[] = []
for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
  if (tab.localDeparture || tab.id === 'sports_theme') continue
  for (const g of tab.groups) {
    geoGroupLabels.push(g.countryLabel)
    for (const leaf of g.cities) {
      leafToGroup.set(leaf.label, g.countryLabel)
    }
  }
}

function firstGeoGroupInTitle(title: string): string | null {
  const t = String(title || '')
  const hits = geoGroupLabels.filter((g) => t.includes(g)).sort((a, b) => t.indexOf(a) - t.indexOf(b) || b.length - a.length)
  return hits[0] || null
}

type Issue = {
  slug: string | null
  code: string
  detail: string
  dest: string
  cityKey: string | null
  title: string
  card: string
  aligned: string | null
  alignReason: string
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered', travelScope: 'overseas' },
    select: {
      slug: true,
      title: true,
      duration: true,
      primaryDestination: true,
      destination: true,
      destinationRaw: true,
      cityKey: true,
      countryKey: true,
      country: true,
      continent: true,
    },
  })

  const issues: Issue[] = []
  const kindCounts: Record<string, number> = {}
  let ok = 0

  for (const p of rows) {
    const dest = String(p.primaryDestination || p.destination || '').trim()
    const kind = classifyMegaMenuDestinationLabel(dest)
    kindCounts[kind] = (kindCounts[kind] || 0) + 1
    const title = String(p.title || '')
    const aligned = alignDestinationToMegaMenuLeaf({
      current: dest,
      title: p.title,
      cityKey: p.cityKey,
      countryKey: p.countryKey,
    })
    const card = resolvePublicBrowseCardTitle(
      {
        title: p.title || '',
        duration: p.duration,
        primaryDestination: p.primaryDestination,
        destination: p.destination,
        destinationRaw: p.destinationRaw,
        cityKey: p.cityKey,
        countryKey: p.countryKey,
        countryRowLabel: p.country,
        primaryRegion: p.continent,
      },
      p.title || '',
    )
    const cardPlace = String(card.cardTitle || '')
      .replace(/\s*\d+\s*박\s*\d+\s*일\s*$/u, '')
      .replace(/\s*\d+\s*일\s*$/u, '')
      .trim()
    const cityLeaf = megaMenuClickLabelForCityKey(p.cityKey)
    const primaryGroup = firstGeoGroupInTitle(title)
    const rowIssues: string[] = []

    if (kind === 'group' || kind === 'other' || kind === 'empty') {
      rowIssues.push(`dest_not_leaf:${kind}`)
    }
    if (aligned.destination && aligned.destination !== dest) {
      rowIssues.push(`align_would_change:${aligned.reason}`)
    }
    if (cityLeaf) {
      const cityKind = classifyMegaMenuDestinationLabel(cityLeaf)
      if (cityKind === 'city' || cityKind === 'country') {
        if (primaryGroup && !megaMenuLeafBelongsToGroup(cityLeaf, primaryGroup)) {
          // 제목 첫 그룹과 cityKey leaf 그룹 불일치 (미동부 vs 나이아가라)
          const leafGroup = leafToGroup.get(cityLeaf) || '?'
          if (leafGroup !== primaryGroup) {
            rowIssues.push(`cityKey_cross_group:${cityLeaf}@${leafGroup}≠${primaryGroup}`)
          }
        }
      }
    }
    if (kind === 'city' && primaryGroup && !megaMenuLeafBelongsToGroup(dest, primaryGroup)) {
      if (!title.includes(dest)) {
        rowIssues.push(`dest_cross_group:${dest}≠${primaryGroup}`)
      }
    }
    // 카드 place가 메가 leaf가 아니거나, 일본 N박 패턴
    const cardKind = classifyMegaMenuDestinationLabel(cardPlace)
    if (cardPlace === '일본' || /^일본\s/.test(card.cardTitle)) {
      rowIssues.push('card_japan_umbrella')
    }
    if (cardKind === 'group') {
      rowIssues.push('card_group_label')
    }
    // 인도/스리랑카 권역인데 카드가 도시만
    if (
      (title.includes('인도') || dest === '인도') &&
      !title.includes('자이푸르') &&
      !title.includes('델리') &&
      !title.includes('아그라') &&
      !title.includes('바라나시') &&
      cardPlace === '자이푸르'
    ) {
      rowIssues.push('card_india_jaipur')
    }
    if (
      (title.includes('스리랑카') || dest === '스리랑카') &&
      !title.includes('콜롬보') &&
      cardPlace === '콜롬보'
    ) {
      rowIssues.push('card_sri_colombo')
    }
    if (
      title.includes('미동부') &&
      !title.includes('나이아가라') &&
      (dest === '나이아가라' || cardPlace === '나이아가라')
    ) {
      rowIssues.push('midong_as_niagara')
    }

    if (rowIssues.length === 0) {
      ok++
      continue
    }
    for (const code of rowIssues) {
      issues.push({
        slug: p.slug,
        code,
        detail: code,
        dest,
        cityKey: p.cityKey,
        title: title.slice(0, 80),
        card: card.cardTitle,
        aligned: aligned.destination,
        alignReason: aligned.reason,
      })
    }
  }

  const byCode: Record<string, number> = {}
  for (const i of issues) byCode[i.code] = (byCode[i.code] || 0) + 1

  const out = {
    total: rows.length,
    ok,
    issueRowApprox: new Set(issues.map((i) => i.slug)).size,
    kindCounts,
    byCode,
    issues: issues.slice(0, 200),
  }
  const outPath = path.join(__dirname, '_audit-mega-menu-product-alignment.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify({ ...out, issues: `(${issues.length} in file)`, outPath }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
