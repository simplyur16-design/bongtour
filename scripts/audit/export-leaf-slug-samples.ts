import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'

const rows: Array<{ label: string; browseSlug: string; tab: string }> = []
for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
  if (tab.localDeparture) continue
  for (const g of tab.groups) {
    for (const leaf of g.cities) {
      if (leaf.kind !== 'city') continue
      rows.push({
        label: leaf.label,
        browseSlug: citySlugFromTermsAndLabel(leaf.label, leaf.terms),
        tab: tab.id,
      })
    }
  }
}
const interesting = rows.filter((r) =>
  /phu|hong|macau|hcm|nha|chiang|guang|mykonos|abu/.test(r.browseSlug + r.label),
)
const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'leaf-slug-samples.json'),
  JSON.stringify({ cityLeafCount: rows.length, interesting }, null, 2),
  'utf8',
)
console.log(`cityLeaves=${rows.length} interesting=${interesting.length}`)
