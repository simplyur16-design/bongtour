/**
 * 국내 목적지 SSOT — 권역·지역·목적지(도시·섬·테마) 통합.
 * @see lib/domestic-location-tree.data.ts
 */
import { DOMESTIC_LOCATION_TREE_DATA } from '@/lib/domestic-location-tree.data'
import type { DomesticAreaNode, DomesticLeafNode, DomesticRegionGroupNode } from '@/lib/domestic-location-tree.types'

export type { DomesticAreaNode, DomesticLeafNode, DomesticRegionGroupNode } from '@/lib/domestic-location-tree.types'

export const DOMESTIC_LOCATION_TREE: DomesticRegionGroupNode[] = DOMESTIC_LOCATION_TREE_DATA

export const DOMESTIC_LOCATION_TREE_CLEAN: DomesticRegionGroupNode[] = DOMESTIC_LOCATION_TREE.map((g) => ({
  ...g,
  areas: g.areas.filter((a) => a.children.length > 0),
}))

function addToken(set: Set<string>, s?: string) {
  if (s && s.trim()) set.add(s.trim())
}

export function matchTokensForDomesticLeaf(_area: DomesticAreaNode, leaf: DomesticLeafNode): string[] {
  const set = new Set<string>()
  addToken(set, leaf.nodeLabel)
  leaf.aliases?.forEach((x) => addToken(set, x))
  leaf.supplierKeywords?.forEach((x) => addToken(set, x))
  return [...set]
}

export function matchTokensForDomesticArea(area: DomesticAreaNode): string[] {
  const set = new Set<string>()
  addToken(set, area.areaLabel)
  area.aliases?.forEach((x) => addToken(set, x))
  area.supplierKeywords?.forEach((x) => addToken(set, x))
  for (const leaf of area.children) {
    matchTokensForDomesticLeaf(area, leaf).forEach((t) => set.add(t))
  }
  return [...set]
}

export function matchTokensForDomesticGroup(group: DomesticRegionGroupNode): string[] {
  const set = new Set<string>()
  addToken(set, group.groupLabel)
  group.aliases?.forEach((x) => addToken(set, x))
  group.supplierKeywords?.forEach((x) => addToken(set, x))
  for (const a of group.areas) {
    matchTokensForDomesticArea(a).forEach((t) => set.add(t))
  }
  return [...set]
}

export function matchTokensForDomesticAreaShallow(area: DomesticAreaNode): string[] {
  const set = new Set<string>()
  addToken(set, area.areaLabel)
  area.aliases?.forEach((x) => addToken(set, x))
  area.supplierKeywords?.forEach((x) => addToken(set, x))
  return [...set]
}

export function matchTokensForDomesticGroupShallow(group: DomesticRegionGroupNode): string[] {
  const set = new Set<string>()
  addToken(set, group.groupLabel)
  group.aliases?.forEach((x) => addToken(set, x))
  group.supplierKeywords?.forEach((x) => addToken(set, x))
  return [...set]
}
