/**
 * 해외 랜딩 메가메뉴 — 권역·국가·도시는 `lib/unified-location-tree` SSOT 에서 생성.
 */
import {
  buildOverseasMegaMenuRegionsWithThemes,
  type MegaMenuCountryGroup,
  type MegaMenuLeaf,
  type MegaMenuRegion,
  type MegaMenuSpecial,
} from '@/lib/unified-location-tree'

export type { MegaMenuLeaf, MegaMenuCountryGroup, MegaMenuRegion, MegaMenuSpecial }

export const OVERSEAS_MEGA_MENU_REGIONS: MegaMenuRegion[] = buildOverseasMegaMenuRegionsWithThemes()

export const OVERSEAS_QUICK_CITY_CHIPS: MegaMenuLeaf[] = OVERSEAS_MEGA_MENU_REGIONS.filter(
  (r) => !r.special && r.countryGroups?.length,
)
  .flatMap((r) => r.countryGroups!.flatMap((g) => g.cities))
  .filter((leaf, i, a) => a.findIndex((x) => x.label === leaf.label) === i)
  .slice(0, 40)

export const OVERSEAS_DESTINATION_BRIEF_FALLBACK =
  '표시 상품은 공급사 등록 기준이며, 일정·요금·출발 확정은 상담 시 안내드립니다.'

export const OVERSEAS_DESTINATION_BRIEFS: Record<string, string> = {
  'northeast-asia': '일본·중국·대만 등 단거리 일정은 항공·비자 확인이 중요합니다.',
  'southeast-asia': '동남아·대만은 휴양·가족 문의가 많고, 도시마다 성수기가 다릅니다.',
  europe: '유럽 일정은 항공 스케줄·비자 확인이 중요합니다.',
  'me-africa': '중동·아프리카는 비자·안전 공지·항공편에 따라 동선이 달라질 수 있습니다.',
  americas: '미주·캐나다는 동부·서부 동선과 시차를 고려한 일정이 많습니다.',
  oceania: '남태평양·호주는 시즌·비행 시간을 함께 보시는 것이 좋습니다.',
  honeymoon: '허니문은 리조트·항공 좌석 상황에 따라 견차가 달라질 수 있습니다.',
  오사카: '간사이 중심으로 교토·고베·나라와 묶는 패턴이 흔합니다.',
  다낭: '해안 리조트와 시내 관광을 함께 구성하는 일정이 많습니다.',
  도쿄: '도심 관광과 근교(하코네·요코하마)를 조합하는 문의가 많습니다.',
}

export function briefingForMegaLabel(regionId: string | undefined, leafLabel: string): string {
  if (regionId && OVERSEAS_DESTINATION_BRIEFS[regionId]) return OVERSEAS_DESTINATION_BRIEFS[regionId]!
  if (OVERSEAS_DESTINATION_BRIEFS[leafLabel]) return OVERSEAS_DESTINATION_BRIEFS[leafLabel]!
  return OVERSEAS_DESTINATION_BRIEF_FALLBACK
}
