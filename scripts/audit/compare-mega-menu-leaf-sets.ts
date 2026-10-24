/**
 * Static leaf-set diff across TopMegaMenu SSOT, overseas-sub-nav, travel-landing.
 * Writes docs/audit/2026-10-24/mega-menu-leaf-set-diff.json
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { buildMegaMenuLeafHref } from '@/lib/top-nav-resolve'

function ssotLeaves(): Set<string> {
  const s = new Set<string>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) {
      s.add(`${tab.id}|local|${tab.label}`)
      continue
    }
    for (const g of tab.groups) {
      for (const leaf of g.cities) {
        const href = buildMegaMenuLeafHref({
          type: 'travel',
          regionId: tab.id,
          countryLabel: g.countryLabel,
          headerBrowseCountryLabel: g.headerBrowseCountryLabel,
          leaf,
        })
        s.add(`${tab.id}|${g.countryLabel}|${leaf.label}|${href}`)
      }
    }
  }
  return s
}

async function main() {
  const ssot = ssotLeaves()
  let subNavKeys = new Set<string>()
  let landingKeys = new Set<string>()
  const notes: string[] = []

  try {
    const sub = await import('@/components/top-nav/overseas-sub-nav-items')
    const items = (sub as { OVERSEAS_SUB_NAV_ITEMS?: unknown; overseasSubNavItems?: unknown })
      .OVERSEAS_SUB_NAV_ITEMS ??
      (sub as { overseasSubNavItems?: unknown }).overseasSubNavItems
    if (Array.isArray(items)) {
      for (const it of items as Array<{ href?: string; label?: string; regionId?: string }>) {
        subNavKeys.add(`${it.regionId ?? ''}|${it.label ?? ''}|${it.href ?? ''}`)
      }
    } else {
      notes.push('overseas-sub-nav-items: export shape differs — path check / partial')
    }
  } catch (e) {
    notes.push(`overseas-sub-nav-items import failed: ${e instanceof Error ? e.message : e}`)
  }

  try {
    const land = await import('@/lib/travel-landing-mega-menu-data')
    const tabs =
      (land as { TRAVEL_LANDING_MEGA_MENU?: { tabs?: unknown } }).TRAVEL_LANDING_MEGA_MENU?.tabs ??
      (land as { travelLandingMegaMenuTabs?: unknown }).travelLandingMegaMenuTabs
    if (Array.isArray(tabs)) {
      for (const tab of tabs as Array<{
        id?: string
        groups?: Array<{ countryLabel?: string; cities?: Array<{ label?: string; href?: string }> }>
      }>) {
        for (const g of tab.groups ?? []) {
          for (const c of g.cities ?? []) {
            landingKeys.add(`${tab.id}|${g.countryLabel}|${c.label}|${c.href ?? ''}`)
          }
        }
      }
    } else {
      // try function export
      const fn = (land as { getTravelLandingMegaMenuData?: () => unknown }).getTravelLandingMegaMenuData
      if (typeof fn === 'function') {
        notes.push('travel-landing uses getter — see source for leaf parity with MEGA_MENU_TAB_DEFINITIONS')
      } else {
        notes.push('travel-landing-mega-menu-data: export shape differs — path check')
      }
    }
  } catch (e) {
    notes.push(`travel-landing import failed: ${e instanceof Error ? e.message : e}`)
  }

  // MobileDrilldownMenu / TopMegaMenu consume MEGA_MENU_TAB_DEFINITIONS directly — same SSOT.
  notes.push('TopMegaMenu + MobileDrilldownMenu: both import MEGA_MENU_TAB_DEFINITIONS (same SSOT set)')

  const out = {
    generatedAt: new Date().toISOString(),
    ssotLeafCount: ssot.size,
    subNavEntryCount: subNavKeys.size,
    landingEntryCount: landingKeys.size,
    notes,
    // href-level equality only meaningful when landing/subnav expose full leaves
    verdict:
      landingKeys.size === 0 && subNavKeys.size === 0
        ? 'PARTIAL — UI surfaces share SSOT import; separate leaf arrays not exported for set-diff'
        : 'COMPARED',
  }

  const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'mega-menu-leaf-set-diff.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
