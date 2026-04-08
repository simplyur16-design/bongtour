/**
 * 국내 목적지 메타 — 권역 → 지역·코스 → 목적지(도시·섬·테마·여행방식).
 * 행정구역 엄밀성보다 상품명·공급사 표기 매칭 실무를 우선한다.
 */

export type DomesticLeafNode = {
  nodeKey: string
  nodeLabel: string
  aliases?: string[]
  supplierKeywords?: string[]
  nodeType?: 'city' | 'region' | 'island' | 'theme' | 'transport' | 'duration'
}

export type DomesticAreaNode = {
  areaKey: string
  areaLabel: string
  aliases?: string[]
  supplierKeywords?: string[]
  children: DomesticLeafNode[]
}

export type DomesticRegionGroupNode = {
  groupKey: string
  groupLabel: string
  aliases?: string[]
  supplierKeywords?: string[]
  areas: DomesticAreaNode[]
}
