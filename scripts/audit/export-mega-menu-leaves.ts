/**
 * Read-only: export all mega-menu leaves → docs/audit/2026-10-24/mega-menu-leaves.json
 * No DB writes.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { buildMegaMenuLeafHref } from '@/lib/top-nav-resolve'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'

type LeafRow = {
  tabId: string
  tabLabel: string
  groupLabel: string
  leafLabel: string
  kind: 'country' | 'city'
  browseCountryLabel: string
  citySlug: string | null
  href: string
  terms: string[]
  localDeparture?: string
}

function main() {
  const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
  mkdirSync(outDir, { recursive: true })
  const leaves: LeafRow[] = []

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) {
      leaves.push({
        tabId: tab.id,
        tabLabel: tab.label,
        groupLabel: '(localDeparture)',
        leafLabel: tab.label,
        kind: 'country',
        browseCountryLabel: '',
        citySlug: null,
        href: `/travel/overseas?region=${encodeURIComponent(tab.id)}`,
        terms: [],
        localDeparture: tab.localDeparture,
      })
      continue
    }
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        const href = buildMegaMenuLeafHref({
          type: 'travel',
          regionId: tab.id,
          countryLabel: group.countryLabel,
          headerBrowseCountryLabel: group.headerBrowseCountryLabel,
          leaf,
        })
        const citySlug =
          leaf.kind === 'city' ? citySlugFromTermsAndLabel(leaf.label, leaf.terms) : null
        leaves.push({
          tabId: tab.id,
          tabLabel: tab.label,
          groupLabel: group.countryLabel,
          leafLabel: leaf.label,
          kind: leaf.kind,
          browseCountryLabel: leaf.browseCountryLabel ?? leaf.label,
          citySlug,
          href,
          terms: leaf.terms,
        })
      }
    }
  }

  const path = join(outDir, 'mega-menu-leaves.json')
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        leafCount: leaves.length,
        leaves,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`[audit] wrote ${path} leaves=${leaves.length}`)
}

main()
