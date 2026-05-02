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
  japan: '일본 일정은 지역·항공편 확인이 중요합니다.',
  'southeast-asia': '동남아·대만·서남아는 휴양·가족 문의가 많고, 도시마다 성수기가 다릅니다.',
  'china-hk-mo': '중국·홍콩·마카오·몽골은 비자·입국 규정·동선 변경 가능성을 함께 확인하세요.',
  'europe-me': '유럽·중동·아프리카는 항공 스케줄·비자·안전 공지에 따라 동선이 달라질 수 있습니다.',
  americas: '미주·캐나다·하와이는 동부·서부 동선과 시차를 고려한 일정이 많습니다.',
  oceania: '괌·사이판·호주·뉴질랜드는 시즌·비행 시간을 함께 보시는 것이 좋습니다.',
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
