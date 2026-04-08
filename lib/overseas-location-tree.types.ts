/**
 * 해외 목적지 메타 — 하나투어·모두투어 운영 권역 기준 통합 트리 타입.
 *
 * `OverseasCountryNode` 의 country는 엄밀한 “국가”만이 아니라, 일본 간토·간사이처럼
 * 공급사 메뉴에서 **국가 하위 권역**으로 취급되는 노드도 포함한다. UI 라벨은 Bong투어
 * 표준, 공급사 변형 표기는 aliases / supplierKeywords 로 매칭한다.
 */

export type OverseasLeafNode = {
  nodeKey: string
  nodeLabel: string
  aliases?: string[]
  supplierKeywords?: string[]
  /** UI에는 안 쓰고 매칭에만 쓰는 공급사 전용 라벨 토큰 */
  supplierOnlyLabels?: string[]
  nodeType?: 'city' | 'region' | 'route' | 'theme'
}

export type OverseasCountryNode = {
  countryKey: string
  countryLabel: string
  aliases?: string[]
  supplierKeywords?: string[]
  children: OverseasLeafNode[]
}

export type OverseasRegionGroupNode = {
  groupKey: string
  groupLabel: string
  aliases?: string[]
  countries: OverseasCountryNode[]
}
