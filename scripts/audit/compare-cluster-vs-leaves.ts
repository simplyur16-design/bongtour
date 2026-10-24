/**
 * Static: compare-cluster place keys vs mega-menu leaf labels/slugs.
 * Writes docs/audit/2026-10-24/compare-cluster-vs-leaves.json
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { resolveComparePlaceClusterFromHay } from '@/lib/similar-itinerary-compare-cluster'

const ALIAS_PROBES = [
  '칭다오',
  '베이징',
  '상하이',
  '광저우',
  '시안',
  '타이페이',
  '시드니',
  '멜버른',
  '오클랜드',
  '퀸스타운',
  '도쿄',
  '오사카',
  '홍콩',
  '마카오',
  '울란바타르',
  '일본',
  '중국',
  '대만',
]

function main() {
  const leavesPath = join(process.cwd(), 'docs/audit/2026-10-24/mega-menu-leaves.json')
  if (!existsSync(leavesPath)) throw new Error('run export-mega-menu-leaves first')
  const leaves = (
    JSON.parse(readFileSync(leavesPath, 'utf8')) as {
      leaves: Array<{ leafLabel: string; citySlug: string | null; kind: string }>
    }
  ).leaves
  const leafLabels = new Set(leaves.map((l) => l.leafLabel))
  const citySlugs = new Set(leaves.filter((l) => l.citySlug).map((l) => l.citySlug!))

  const clusterKeys: Array<{ key: string; label: string }> = []
  const seen = new Set<string>()
  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture) continue
    for (const g of tab.groups) {
      for (const leaf of g.cities) {
        const key = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        if (seen.has(key)) continue
        seen.add(key)
        clusterKeys.push({ key, label: leaf.label })
      }
    }
  }

  const missingLabel = clusterKeys.filter((c) => !leafLabels.has(c.label))
  const aliasHits = ALIAS_PROBES.map((hay) => {
    const hit = resolveComparePlaceClusterFromHay(hay)
    return {
      hay,
      key: hit?.key ?? null,
      label: hit?.label ?? null,
      labelInLeaves: hit ? leafLabels.has(hit.label) : null,
      keyInCitySlugs: hit ? citySlugs.has(hit.key) : null,
    }
  })

  const collisions: Array<{ a: string; b: string; key: string }> = []
  // 칭다오→청도 vs 다른 leaf 충돌 여부: alias probes that resolve to same key as another probe with different hay intent
  const byKey = new Map<string, string[]>()
  for (const a of aliasHits) {
    if (!a.key) continue
    const arr = byKey.get(a.key) ?? []
    arr.push(a.hay)
    byKey.set(a.key, arr)
  }

  const out = {
    generatedAt: new Date().toISOString(),
    megaLeafCount: leaves.length,
    compareClusterKeyCount: clusterKeys.length,
    missingLabelInLeaves: missingLabel,
    aliasHits,
    aliasKeyGroups: [...byKey.entries()].map(([key, hays]) => ({ key, hays })),
    collisions,
    note: 'COMPARE_LEAVES built from MEGA_MENU_TAB_DEFINITIONS — key count should match unique leaf slugs',
  }
  const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'compare-cluster-vs-leaves.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(
    `[audit] compareKeys=${clusterKeys.length} leafLabels=${leafLabels.size} missingLabel=${missingLabel.length}`,
  )
  console.log(JSON.stringify(aliasHits, null, 2))
}

main()
