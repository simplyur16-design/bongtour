/**
 * 해외 트리 시드 vs 메가메뉴 정적 SSOT 갭 리포트 (DB 불필요).
 *   npx tsx scripts/audit-geo-master-static-gap.ts
 *   npx tsx scripts/audit-geo-master-static-gap.ts --write-doc
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { buildMasterSeedFromTree, buildMegaMenuRegionCardPayload } from './seed-master-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

function collectMegaMenuBrowseSlugs(): {
  countries: Set<string>
  cities: Array<{ tabId: string; countrySlug: string; citySlug: string; label: string }>
} {
  const countries = new Set<string>()
  const cities: Array<{ tabId: string; countrySlug: string; citySlug: string; label: string }> = []

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const group of tab.groups) {
      const countrySlug = countrySlugFromLabel(group.countryLabel)
      if (countrySlug) countries.add(countrySlug)
      for (const leaf of group.cities) {
        const browseCountry = leaf.browseCountryLabel ?? leaf.label
        const cSlug = countrySlugFromLabel(browseCountry) ?? countrySlug
        const citySlug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        if (cSlug) countries.add(cSlug)
        if (citySlug && cSlug) {
          cities.push({ tabId: tab.id, countrySlug: cSlug, citySlug, label: leaf.label })
        }
      }
    }
  }
  return { countries, cities }
}

function main(): void {
  const seed = buildMasterSeedFromTree(OVERSEAS_LOCATION_TREE_DATA)
  const megaCards = buildMegaMenuRegionCardPayload()
  const menu = collectMegaMenuBrowseSlugs()

  const seedCountryKeys = new Set(seed.countries.map((c) => c.countryKey))
  const seedCityKeys = new Set(seed.cities.map((c) => c.cityKey))
  const seedContinentKeys = new Set(seed.continents.map((c) => c.continentKey))

  const menuCountriesNotInSeed = [...menu.countries].filter((k) => !seedCountryKeys.has(k)).sort()
  const menuCitiesNotInSeed = menu.cities.filter((c) => !seedCityKeys.has(c.citySlug))

  const cardCountryKeys = new Set(megaCards.cardCountryPairs.map((p) => p.countryKey))
  const cardCityKeys = new Set(megaCards.cardCityPairs.map((p) => p.cityKey))
  const seedCountriesNotOnCard = [...seedCountryKeys].filter(
    (k) => k !== 'korea' && !cardCountryKeys.has(k),
  )
  const seedCitiesNotOnCard = [...seedCityKeys].filter((k) => !cardCityKeys.has(k))

  const report = {
    counts: {
      seedContinents: seed.continents.length,
      seedCountries: seed.countries.length,
      seedCities: seed.cities.length,
      megaMenuBrowseCountries: menu.countries.size,
      megaMenuBrowseCityLeaves: menu.cities.length,
      megaMenuRegionCards: megaCards.stats.cardCount,
      cardCountryLinks: megaCards.stats.countryLinkCount,
      cardCityLinks: megaCards.stats.cityLinkCount,
    },
    gaps: {
      menuCountrySlugsMissingInTreeSeed: menuCountriesNotInSeed,
      menuCityLeavesMissingInTreeSeed: menuCitiesNotInSeed.slice(0, 80),
      menuCityLeavesMissingInTreeSeedCount: menuCitiesNotInSeed.length,
      seedCountriesNotOnMegaMenuCard: seedCountriesNotOnCard.slice(0, 40),
      seedCountriesNotOnMegaMenuCardCount: seedCountriesNotOnCard.length,
      seedCitiesNotOnMegaMenuCard: seedCitiesNotOnCard,
      seedCitiesNotOnMegaMenuCardCount: seedCitiesNotOnCard.length,
    },
    note:
      '메가메뉴 UI 탭 id(europe-me 등)는 트리 groupKey(europe-me-africa)와 별도. PR2에서 browse·UI SSOT 통합.',
  }

  console.log(JSON.stringify(report, null, 2))

  if (process.argv.includes('--write-doc')) {
    const lines: string[] = [
      '# Phase 1 — 지리 마스터 시드 vs 정적 SSOT 갭',
      '',
      '생성: `npx tsx scripts/audit-geo-master-static-gap.ts --write-doc`',
      '',
      '## 요약',
      '',
      `| 구분 | 트리 시드 | 메가메뉴 browse 슬러그 | 권역 카드 링크 |`,
      `|------|----------|----------------------|----------------|`,
      `| 대륙 | ${report.counts.seedContinents} | — | ${report.counts.megaMenuRegionCards} cards |`,
      `| 국가 | ${report.counts.seedCountries} | ${report.counts.megaMenuBrowseCountries} | ${report.counts.cardCountryLinks} links |`,
      `| 도시 | ${report.counts.seedCities} | ${report.counts.megaMenuBrowseCityLeaves} leaves | ${report.counts.cardCityLinks} links |`,
      '',
      '## 차이 — 메가메뉴에만 있고 트리 시드에 없음',
      '',
      '### 국가 슬러그',
      '',
    ]
    if (menuCountriesNotInSeed.length === 0) {
      lines.push('_없음 (browse 슬러그는 트리 시드 Country와 정합)_')
    } else {
      for (const k of menuCountriesNotInSeed) lines.push(`- \`${k}\``)
    }
    lines.push('', '### 도시 leaf (상위 80건)', '')
    if (menuCitiesNotInSeed.length === 0) {
      lines.push('_없음_')
    } else {
      lines.push('| tab | country | citySlug | label |', '|-----|---------|----------|-------|')
      for (const c of menuCitiesNotInSeed.slice(0, 80)) {
        lines.push(`| ${c.tabId} | ${c.countrySlug} | ${c.citySlug} | ${c.label} |`)
      }
      if (menuCitiesNotInSeed.length > 80) {
        lines.push('', `… 외 ${menuCitiesNotInSeed.length - 80}건`)
      }
    }
    lines.push(
      '',
      '## 차이 — 트리 시드에 있으나 MegaMenuGroupCard에 미연결',
      '',
      `- 국가: ${seedCountriesNotOnCard.length}건 (korea 제외)`,
      `- 도시: ${seedCitiesNotOnCard.length}건 — ${seedCitiesNotOnCard.map((k) => `\`${k}\``).join(', ') || '없음'} (국내 지방출발·PR2 범위)`,
      '',
      '## 메가메뉴 UI browse 슬러그 vs Country.countryKey',
      '',
      '메가메뉴 `mega-menu-regions.data.ts`는 한글 라벨·browse 슬러그(예: `나트랑`, `uk`)를 쓰고, DB 마스터는 `countryKey`/`cityKey`(예: `vietnam`, `nhatrang`)를 씁니다. **동일 키 공간이 아니므로** 위 JSON의 `menuCountrySlugsMissingInTreeSeed` 대부분은 PR2 browse 통합 전 **표기 차이**이며, Phase1 마이그는 **트리 시드 77국·247도시 upsert**로 DB 정합을 맞춥니다.',
      '',
      '## 마이그레이션',
      '',
      'Supabase: `supabase/migrations/20260520120000_phase1_geo_master_seed.sql`',
      '기존 `20260510120000_megamenu_card_seed_patch.sql` + 시드 upsert. 수동 apply.',
      '',
    )

    const docPath = join(REPO_ROOT, 'docs', 'ops', 'phase1-geo-master-seed-gap-report.md')
    mkdirSync(dirname(docPath), { recursive: true })
    writeFileSync(docPath, lines.join('\n'), 'utf8')
    console.log('[audit] wrote', docPath)
  }

  void seedContinentKeys
}

main()
