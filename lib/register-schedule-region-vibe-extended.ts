/**
 * 확장 지역 vibe 문장 — lottetour 표에 없는 중국·중앙아·미주 등.
 * lottetour와 순환 import 금지용으로 분리.
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]: 공급사 문장 우선, 없으면 route 명소 2~3문장 — manifest
 */
import { composeRegisterScheduleCharacteristicDescription } from '@/lib/register-schedule-description-characteristic-ssot'

const GENERIC_TOURISM_MARKER = '하루 동안 여러 장면이 자연스럽게 이어지는'

export function isRegisterScheduleGenericTourismDescription(desc: string): boolean {
  return desc.includes(GENERIC_TOURISM_MARKER)
}

/**
 * 장소명이 vibe 문장에 섞일 때 — 같은 프로필 대체 문장·확장 지역만 시도.
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: place leak must not downgrade to generic — manifest
 */
export function pickScheduleVibeSentencesWithoutPlaceLeak(
  profileSentences: readonly string[],
  routePlaces: readonly string[],
  leakChunksFor: (label: string) => string[],
  regionalFallback: () => string | null,
): string {
  const join = (sents: readonly string[]) => sents.slice(0, 3).join(' ')
  let desc = join(profileSentences)
  for (const h of routePlaces) {
    for (const chunk of leakChunksFor(h)) {
      if (!chunk || !desc.includes(chunk)) continue
      const alt = profileSentences.filter((s) => !s.includes(chunk))
      if (alt.length >= 1) {
        desc = join(alt)
        continue
      }
      const regional = regionalFallback()
      if (regional && !isRegisterScheduleGenericTourismDescription(regional)) {
        desc = regional
        break
      }
      // non-generic 프로필을 generic으로 떨어뜨리지 않음
      break
    }
  }
  return desc.slice(0, 720).trim()
}

type ExtendedRegionVibeProfile =
  | 'china_coastal'
  | 'china_zhangjiajie'
  | 'china_beijing'
  | 'china_city_walk'
  | 'japan_onsen_town'
  | 'japan_city_walk'
  | 'thailand_bangkok'
  | 'thailand_beach'
  | 'central_asia_steppe'
  | 'canada_rockies'
  | 'us_west_nature'
  | 'us_west_city'
  | 'mediterranean_coast'
  | 'croatia_adriatic'
  | 'balkans_city'
  | 'alaska_cruise'
  | 'hokkaido_nature'
  | 'nordic_fjord'
  | 'egypt_nile'
  | 'india_golden'
  | 'india_varanasi'
  | 'india_khajuraho'
  | 'ordos_steppe'
  | 'vietnam_south'
  | 'hong_kong_city'
  | 'hong_kong_disney'
  | 'oceania_nz'
  | 'hawaii_islands'
  | 'south_america'
  | 'laos_mekong'
  | 'switzerland_alps'
  | 'spain_iberia'
  | 'portugal_atlantic'
  | 'taiwan_island'
  | 'mongolia_steppe'
  | 'caucasus_caspian'
  | 'caucasus_georgia_armenia'
  | 'uae_gulf'
  | 'micronesia_islands'
  | 'sea_diving'
  | 'japan_kyushu'
  | 'italy_cities'
  | 'philippines_islands'
  | 'africa_safari'
  | 'austria_alps'
  | 'central_europe_city'
  | 'singapore_city'

const EXTENDED_REGION_VIBE_DESCRIPTIONS: Record<ExtendedRegionVibeProfile, readonly string[]> = {
  china_coastal: [
    '항구 도시와 해변·광장이 이어지는, 바닷바람 리듬의 하루입니다.',
    '짧은 이동마다 시야가 열려, 도심과 해안의 대비를 함께 느끼기 좋은 구성입니다.',
    '항구 바람과 도심 밀도가 교차하며 걷는 속도가 자연히 조절됩니다.',
    '해안 시야가 열리는 구간이 하루의 호흡을 잡아 주는 구성입니다.',
  ],
  china_zhangjiajie: [
    '기암과 협곡이 이어지는 하루로, 풍경의 스케일이 일정 흐름을 이끕니다.',
    '이동보다 시야가 열리는 순간이 중심이 되어 여운이 길게 남는 구성입니다.',
    '기암 능선과 협곡의 깊이감이 이동보다 앞서 하루를 이끕니다.',
    '풍경의 스케일이 커질수록 걸음의 리듬이 느려지는 일정입니다.',
  ],
  china_beijing: [
    '역사 유적과 도심 광장이 이어지는, 수도의 밀도가 돋보이는 하루입니다.',
    '걷는 리듬과 시야 확장이 번갈아 이어져 도시의 결을 천천히 쌓아 갑니다.',
    '옛 축과 현대 거리가 교차해 하루의 밀도가 또렷합니다.',
    '광장의 개방감과 골목의 깊이가 번갈아 이어지는 구성입니다.',
  ],
  china_city_walk: [
    '골목과 거리·광장이 이어지는, 중국 도심의 걷는 리듬이 중심인 하루입니다.',
    '짧은 체류에도 분위기 차이가 분명하게 느껴지는 구성입니다.',
    '상점가와 골목의 소음 결이 달라 장면이 자연스럽게 갈립니다.',
    '도보 위주로 도시의 층위를 천천히 쌓아 가는 일정입니다.',
  ],
  japan_onsen_town: [
    '온천 마을과 거리 풍경이 이어지는, 차분한 일본의 하루입니다.',
    '무거운 이동 없이 주변 분위기를 천천히 음미하며 호흡을 고르는 일정입니다.',
    '수증기와 골목 공기가 하루의 온도를 낮춰 줍니다.',
    '머무르는 감각이 관광 이동보다 앞서는 구성입니다.',
  ],
  japan_city_walk: [
    '신사·상점가·골목이 이어지는, 걷는 즐거움이 중심인 하루입니다.',
    '도심의 리듬에 맞춰 장면이 자연스럽게 바뀌는 알찬 구성입니다.',
    '전통과 현대 거리가 교차해 걷는 밀도가 또렷합니다.',
    '짧은 골목마다 분위기가 바뀌어 여정이 가볍게 쌓입니다.',
  ],
  japan_kyushu: [
    '온천·강변·항구 도시가 이어지는, 규슈의 여유로운 하루입니다.',
    '규슈 온천과 항구의 결이 짧은 이동마다 바뀌어 여정이 또렷합니다.',
    '온천 마을의 한적함과 항구의 개방감이 교차하는 하루입니다.',
    '규슈 강변 공기와 온천 리듬이 여행의 속도를 천천히 낮춥니다.',
  ],
  thailand_bangkok: [
    '왕궁·사원·수변이 이어지는, 방콕의 밀도가 느껴지는 하루입니다.',
    '도심을 가로지르며 전통과 현대의 대비를 함께 담는 구성입니다.',
  ],
  thailand_beach: [
    '섬과 해안이 이어지는, 여유로운 남국의 하루입니다.',
    '수상 활동과 해변 리듬이 번갈아 이어져 감각이 또렷해지는 구성입니다.',
  ],
  vietnam_south: [
    '섬과 고원·야시장이 이어지는, 베트남 남부의 여유로운 하루입니다.',
    '걷는 리듬과 수변 분위기가 번갈아 이어져 감각이 또렷해지는 구성입니다.',
    '수변의 습기와 고원의 바람이 교차하며 하루의 결이 갈립니다.',
    '야시장의 밀도와 섬의 여백이 번갈아 이어지는 구성입니다.',
  ],
  hong_kong_city: [
    '번화가와 골목·전망이 이어지는, 도보 리듬이 중심인 하루입니다.',
    '골목 도보와 전망이 자연스럽게 섞여 걷는 즐거움이 돋보입니다.',
    '번화가 언덕길과 골목이 붙어 있어 짧은 구간에도 장면이 빠르게 바뀝니다.',
    '도보 위주로 골목과 전망의 밀도를 함께 느끼는 구성입니다.',
  ],
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: hong_kong_disney — 란타우·테마파크 ≠ 규슈/generic — manifest
  hong_kong_disney: [
    '테마파크 하루로, 이동보다 놀이와 장면이 중심인 일정입니다.',
    '짧은 이동 없이 파크 안에서 분위기가 이어져 여정이 또렷하게 느껴지는 구성입니다.',
    '구역마다 조명과 음악의 결이 달라 체류 밀도가 높은 하루입니다.',
    '걷기보다 머무르며 놀이 리듬을 쌓아 가는 구성입니다.',
  ],
  central_europe_city: [
    '중세 골목과 광장이 이어지는, 걷는 리듬이 중심인 하루입니다.',
    '성·다리·구시가지가 자연스럽게 연결되어 도시의 결을 천천히 느낍니다.',
    '광장의 개방감과 골목의 깊이가 교차해 도보 밀도가 또렷합니다.',
    '옛 도시의 층위가 짧은 이동에도 분명하게 바뀌는 구성입니다.',
  ],
  singapore_city: [
    '정원·전망·해안이 이어지는, 걷기와 시야 확장이 균형을 이루는 하루입니다.',
    '도심 정원과 해안 전망이 하루 흐름에 맞춰 이어지는 구성입니다.',
    '수변과 정원·거리의 결이 번갈아 나타나 도보 리듬이 또렷합니다.',
    '해안 시야와 정원 그늘이 교차하며 여정이 가볍게 쌓입니다.',
  ],
  oceania_nz: [
    '호수·산자락·시내 거리가 이어지는, 뉴질랜드의 시야가 열리는 하루입니다.',
    '이동마다 풍경의 스케일이 바뀌어 여운이 길게 남는 구성입니다.',
  ],
  hawaii_islands: [
    '해변과 화산·문화 거점이 이어지는, 하와이의 여유로운 하루입니다.',
    '수변과 시내 분위기가 번갈아 이어져 감각이 또렷해지는 구성입니다.',
  ],
  us_west_city: [
    '전망대와 거리·해안 공원이 이어지는, 미서부 도시의 걷는 리듬이 중심인 하루입니다.',
    '짧은 체류에도 분위기 차이가 또렷해 여정이 부드럽게 이어집니다.',
  ],
  italy_cities: [
    '광장과 성당·골목이 이어지는, 이탈리아 도시의 걷는 리듬이 중심인 하루입니다.',
    '광장과 골목을 걷는 리듬이 도시마다 달라 여정이 부드럽게 이어집니다.',
    '구릉과 골목·운하의 결이 번갈아 나타나 도보 하루가 또렷합니다.',
    '광장에 머무르는 시간과 골목을 걷는 리듬이 균형을 이룹니다.',
  ],
  philippines_islands: [
    '해변과 섬·리조트 풍경이 이어지는, 필리핀의 여유로운 하루입니다.',
    '수변과 시내 분위기가 번갈아 이어져 감각이 또렷해지는 구성입니다.',
  ],
  africa_safari: [
    '초원·보호구와 산자락 풍경이 이어지는, 사파리의 스케일이 돋보이는 하루입니다.',
    '이동마다 시야가 열려 야생과 지형의 대비가 분명하게 느껴지는 구성입니다.',
  ],
  austria_alps: [
    '알프스 산자락과 구시가지·전망이 이어지는, 오스트리아의 시야가 열리는 하루입니다.',
    '짧은 이동에도 도시와 산의 결이 달라 여정이 부드럽게 이어집니다.',
  ],
  south_america: [
    '고원 도시와 유적·폭포 풍경이 이어지는, 남미의 스케일이 돋보이는 하루입니다.',
    '이동마다 고도와 풍경의 결이 바뀌어 여정이 분명하게 느껴지는 구성입니다.',
  ],
  laos_mekong: [
    '강변 마을과 동굴·자연 풍경이 이어지는, 라오스의 차분한 하루입니다.',
    '무거운 이동 없이 주변 분위기를 천천히 음미하는 구성입니다.',
  ],
  switzerland_alps: [
    '호수와 설봉·산악 열차 풍경이 이어지는, 알프스의 시야가 열리는 하루입니다.',
    '알프스 호수와 설봉이 열리는 순간이 중심이 되어 여운이 길게 남습니다.',
    '알프스 고도가 바뀔 때마다 산악 공기와 빛의 결이 달라지는 하루입니다.',
    '호숫가의 고요함과 설봉 능선의 개방감이 번갈아 이어집니다.',
  ],
  spain_iberia: [
    '성당·궁전과 골목 풍경이 이어지는, 이베리아의 걷는 리듬이 중심인 하루입니다.',
    '짧은 이동에도 도시마다 결이 달라 여정이 부드럽게 이어집니다.',
  ],
  portugal_atlantic: [
    '해안과 구시가지·광장이 이어지는, 포르투갈의 여유로운 하루입니다.',
    '바다와 골목의 대비가 시야를 넓히며 걷는 즐거움이 흐름의 중심이 됩니다.',
  ],
  taiwan_island: [
    '옛거리와 항구·야시장이 이어지는, 대만의 걷는 리듬이 중심인 하루입니다.',
    '짧은 체류에도 분위기 차이가 분명하게 느껴지는 구성입니다.',
  ],
  mongolia_steppe: [
    '초원과 수도 거리가 이어지는, 몽골의 스케일이 돋보이는 하루입니다.',
    '이동마다 풍경의 결이 바뀌어 여정이 분명하게 느껴지는 구성입니다.',
  ],
  caucasus_caspian: [
    '구시가지와 궁전·산기슭 풍경이 이어지는, 카스피해 연안의 하루입니다.',
    '걷는 리듬과 시야 확장이 번갈아 이어져 도시의 결을 쌓아 갑니다.',
  ],
  caucasus_georgia_armenia: [
    '성당·요새와 산기슭 풍경이 이어지는, 코카서스의 걷는 리듬이 중심인 하루입니다.',
    '짧은 이동에도 도시마다 결이 달라 여정이 부드럽게 이어집니다.',
  ],
  uae_gulf: [
    '해안 스카이라인과 전통 지구가 이어지는, 걸프의 대비가 돋보이는 하루입니다.',
    '걸프 도심과 수변의 리듬이 번갈아 이어져 여정이 또렷하게 느껴지는 구성입니다.',
    '걸프 사막 가장자리의 빛과 항구 바람이 교차하며 장면이 갈립니다.',
    '걸프 현대 거리의 밀도와 전통 골목의 여백이 하루를 나눠 줍니다.',
  ],
  micronesia_islands: [
    '해변과 리조트·섬 풍경이 이어지는, 남국의 여유로운 하루입니다.',
    '수상 활동과 해변 리듬이 번갈아 이어져 감각이 또렷해지는 구성입니다.',
  ],
  sea_diving: [
    '해양 공원과 항구·수변 거리가 이어지는, 다이빙·섬 여행의 하루입니다.',
    '수중과 시내 분위기가 번갈아 이어져 여운이 길게 남는 구성입니다.',
  ],
  central_asia_steppe: [
    '초원·협곡·도시 거리가 이어지는, 중앙아시아의 스케일이 돋보이는 하루입니다.',
    '중앙아시아 초원과 협곡의 결이 이동마다 바뀌어 여정이 분명합니다.',
    '중앙아시아 지평선이 열리는 구간에서 하루의 호흡이 크게 넓어집니다.',
    '중앙아시아 도시 골목과 초원 가장자리가 교차하며 장면이 갈립니다.',
  ],
  canada_rockies: [
    '국립공원과 호수·폭포가 이어지는, 캐나다 록키의 대자연이 중심인 하루입니다.',
    '록키 호수와 폭포의 시야가 열리는 순간이 흐름을 이끌며 여운이 남습니다.',
    '국립공원 협곡과 수면의 대비가 분명해 걷는 속도가 자연히 느려집니다.',
    '록키 대자연의 스케일이 이동보다 앞서 하루를 이끄는 구성입니다.',
  ],
  us_west_nature: [
    '국립공원과 협곡·사막 풍경이 이어지는, 미서부의 스케일이 돋보이는 하루입니다.',
    '이동보다 풍경의 대비가 중심이 되어 하루의 리듬이 또렷합니다.',
  ],
  mediterranean_coast: [
    '해안과 마을·유적이 이어지는, 지중해 연안의 여유로운 하루입니다.',
    '바다와 골목의 대비가 시야를 넓히며 걷는 즐거움이 흐름의 중심이 됩니다.',
    '유적의 밀도와 해안 여백이 교차하며 하루의 결이 갈립니다.',
    '마을 골목을 걷는 리듬이 수변 전망과 자연스럽게 붙습니다.',
  ],
  croatia_adriatic: [
    '아드리아 해안과 성벽·국립공원이 이어지는, 크로아티아의 풍경이 중심인 하루입니다.',
    '이동마다 시야가 열려 바다와 돌마을의 대비가 분명하게 느껴지는 구성입니다.',
    '성벽 골목의 밀도와 국립공원의 개방감이 번갈아 이어집니다.',
    '해안 바람이 돌마을 걷는 리듬을 부드럽게 낮춰 줍니다.',
  ],
  balkans_city: [
    '광장과 골목·성당이 이어지는, 발칸 도시의 걷는 리듬이 중심인 하루입니다.',
    '짧은 체류에도 분위기 차이가 또렷해 여정이 부드럽게 이어집니다.',
  ],
  alaska_cruise: [
    '빙하·피오르드와 선상의 여유 리듬이 이어지는, 알래스카 크루즈의 하루입니다.',
    '이동보다 풍경이 열리는 순간이 중심이 되어 여운이 길게 남는 구성입니다.',
  ],
  hokkaido_nature: [
    '온천 마을과 꽃밭·협곡이 이어지는, 홋카이도의 자연 리듬이 중심인 하루입니다.',
    '홋카이도 협곡과 꽃밭의 결이 짧은 이동마다 바뀌어 여정이 또렷합니다.',
    '온천 마을의 수증기와 협곡의 시야가 교차하며 하루의 호흡이 깊어집니다.',
    '꽃밭·온천·협곡이 이어져 홋카이도의 자연 스케일이 돋보이는 구성입니다.',
  ],
  nordic_fjord: [
    '피오르드와 항구·구시가지가 이어지는, 북유럽의 시야가 열리는 하루입니다.',
    '북유럽 피오르드와 항구의 대비가 분명해 여정의 호흡이 길게 남습니다.',
    '북유럽 절벽과 수면이 맞닿은 시야가 하루의 하이라이트를 만듭니다.',
    '북유럽 구시가지 골목과 항구의 개방감이 교차하는 구성입니다.',
  ],
  egypt_nile: [
    '신전과 나일 강변·사막 풍경이 이어지는, 이집트의 스케일이 중심인 하루입니다.',
    '유적과 이동의 리듬이 번갈아 이어져 여운이 길게 남는 구성입니다.',
  ],
  india_golden: [
    '요새와 사원·광장이 이어지는, 인도 골든트라이앵글의 밀도가 돋보이는 하루입니다.',
    '골든트라이앵글 광장과 요새의 결이 걷는 리듬과 시야 확장을 이끕니다.',
    '골든트라이앵글 사원·광장이 이어져 도시의 밀도가 천천히 쌓입니다.',
    '골든트라이앵글의 요새와 거리가 교차하며 하루의 결이 또렷합니다.',
  ],
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: India Varanasi/Khajuraho ≠ golden reuse — manifest
  india_varanasi: [
    '강변 사원과 골목이 이어지는, 신앙 리듬이 중심인 하루입니다.',
    '강변과 골목의 대비가 분명해 여정의 결이 깊게 남는 구성입니다.',
    '강변의 향과 골목의 밀도가 교차하며 하루가 느려집니다.',
    '강변의 의식과 골목 걷는 리듬이 번갈아 이어지는 구성입니다.',
  ],
  india_khajuraho: [
    '사원군과 조각·유적 풍경이 이어지는, 밀도가 돋보이는 하루입니다.',
    '조각과 유적 시야가 걷는 리듬과 번갈아 이어져 여운이 길게 남습니다.',
    '사원 조각의 디테일이 짧은 체류에도 깊게 남는 구성입니다.',
    '유적 구역을 천천히 걸으며 조각의 밀도를 느끼는 하루입니다.',
  ],
  ordos_steppe: [
    '초원과 사막·게르 풍경이 이어지는, 내몽골 오르도스의 스케일이 중심인 하루입니다.',
    '이동마다 풍경의 결이 바뀌어 여정이 분명하게 느껴지는 구성입니다.',
  ],
}

function inferExtendedRegionVibeProfile(joinedBlob: string): ExtendedRegionVibeProfile | null {
  if (/장가계|천문산|천자산|원가계|보봉|어필봉|미혼대|Zhangjiajie/i.test(joinedBlob)) {
    return 'china_zhangjiajie'
  }
  if (/북경|베이징|Beijing|자금성|천안문|만리장성|이화원|후통/i.test(joinedBlob)) {
    return 'china_beijing'
  }
  if (
    /대련|大连|여순|동관거리|러시아거리|칭다오|청도|연태|위해|상해|上海|푸동|외탄|항주|소주|서안|시안/i.test(
      joinedBlob,
    )
  ) {
    return 'china_coastal'
  }
  if (/중국|China|호남|호북|사천|운남|광저우|심천|하이난/i.test(joinedBlob)) {
    return 'china_city_walk'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: central Asia before japan onsen — 악수온천≠일본 — manifest
  if (
    /알마티|침블락|침볼락|차른|콜사이|타슈켄트|사마르칸트|사마르칸|우즈베|카자흐|키르기스|중앙아시아|비슈케크|아프로시압|울루그벡|구르\s*아미르|레기스탄|젠코바|판필로바|이식쿨|알라아르차|촐폰|블랙\s*캐년|악수\s*온천|카라콜/i.test(
      joinedBlob,
    )
  ) {
    return 'central_asia_steppe'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: Hong Kong before japan kyushu — manifest
  if (
    /디즈니|Disney|테마파크/i.test(joinedBlob) &&
    /홍콩|Hong\s*Kong|란타우|Lantau/i.test(joinedBlob)
  ) {
    return 'hong_kong_disney'
  }
  if (
    /홍콩|Hong\s*Kong|란타우|Lantau|소호|SoHo|타이쿤|빅토리아\s*피크|피크트램|헐리우드\s*로드|미드레벨|웡타이신|구룡|九龍|침사추이|완차이|센트럴/i.test(
      joinedBlob,
    )
  ) {
    return 'hong_kong_city'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: japan onsen — bare 온천 alone 금지 — manifest
  if (
    /돗토리|유후인|벳푸|kusatsu|하코네|기노사키|아타미|(?:일본|Japan).{0,16}온천|온천.{0,16}(?:유후|벳푸|하코네|기노사키|아타미|돗토리)/i.test(
      joinedBlob,
    )
  ) {
    return 'japan_onsen_town'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
  if (
    /홋카이도|북해도|치토세|삿포로|삿포|죠잔케이|후라노|비에이|소운쿄|오타루|하코다테|Hokkaido|Sapporo|Furano|Biei/i.test(
      joinedBlob,
    )
  ) {
    return 'hokkaido_nature'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: 사가현 — bare 사가/아소/Oita 오탐 금지 — manifest
  if (
    /야나가와|후쿠오카|벳푸|유후인|규슈|큐슈|이마리|아리타|사가현|사가시|(?:^|[^가-힣])사가(?:$|[^가-힣])|아소산|아소\s*칼데라|아소시|(?:^|[^가-힣])아소(?:$|[^가-힣])|\bOita\b|\bFukuoka\b|\bKyushu\b|\bAso\b/i.test(
      joinedBlob,
    )
  ) {
    return 'japan_kyushu'
  }
  if (/교토|오사카|도쿄|도톤보리|기요미즈|아라시야마|닛코|가나자와|일본|가미코치|이누야마|나고야|다카마츠/i.test(joinedBlob)) {
    return 'japan_city_walk'
  }
  if (
    /푸꾸옥|Phu\s*Quoc|달랏|Da\s*Lat|그랜드월드|쯔엉동|꾸란|호치민|호찌민|다낭|호이안|나트랑/i.test(
      joinedBlob,
    )
  ) {
    return 'vietnam_south'
  }
  if (/오아후|Oahu|호놀룰루|Honolulu|하와이|Hawaii|진주만|다이아몬드\s*헤드|노스쇼어|와이키키/i.test(joinedBlob)) {
    return 'hawaii_islands'
  }
  if (
    /퀸스타운|Queenstown|오클랜드|Auckland|크라이스트처치|Christchurch|밀포드|테카포|마운트\s*쿡|뉴질랜드|New\s*Zealand/i.test(
      joinedBlob,
    )
  ) {
    return 'oceania_nz'
  }
  if (/파타야|니모|스노클|푸켓|사무이|크라비/i.test(joinedBlob)) {
    return 'thailand_beach'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: UAE before Bangkok 왕궁 — 아부다비 왕궁≠방콕 — manifest
  if (/두바이|Dubai|아부다비|Abu\s*Dhabi|바스타키아|아브라|셰이크|버즈\s*칼리파|UAE|에미리트|에미레이트/i.test(joinedBlob)) {
    return 'uae_gulf'
  }
  // bare「왕궁」만으로 방콕 금지 — 아부다비 왕궁·유럽 왕궁 오탐
  if (/방콕|에메랄드|수상가옥|짜오프라야|아시아티크|농눅|(?:방콕).{0,20}왕궁|왕궁.{0,20}(?:방콕)/i.test(joinedBlob)) {
    return 'thailand_bangkok'
  }
  if (
    /샌프란|San\s*Francisco|로스앤젤|로스엔젤|Los\s*Angeles|\bLA\b|할리우드|Hollywood|팔레스\s*오브|Palace\s*of\s*Fine|예술가의\s*마을/i.test(
      joinedBlob,
    )
  ) {
    return 'us_west_city'
  }
  if (
    /융프라우|Jungfrau|루체른|Lucerne|인터라켄|Interlaken|체르마트|Zermatt|스위스|Switzerland|리기산|(?<![가-힣])리기(?![가-힣])|\bRigi\b|빈사의\s*사자/i.test(
      joinedBlob,
    )
  ) {
    return 'switzerland_alps'
  }
  if (
    /두오모|Duomo|시뇨리아|베키오|피렌체|Florence|Firenze|(?<![가-힣])로마(?![가-힣])|\bRome\b|바티칸|Vatican|베네치아|Venice|마테라|Matera|솔로프라|폼페이|Pompeii|나폴리|Naples|이탈리아|Italy/i.test(
      joinedBlob,
    )
  ) {
    return 'italy_cities'
  }
  if (
    /보홀|Bohol|알로나|Alona|세부|Cebu|보라카이|Boracay|마닐라|Manila|팔라완|Palawan|필리핀|Philippines/i.test(
      joinedBlob,
    )
  ) {
    return 'philippines_islands'
  }
  if (
    /세렝게티|Serengeti|응고롱고로|Ngorongoro|케이프타운|Cape\s*Town|테이블\s*마운틴|Table\s*Mountain|사파리|Safari|킬리만자로|Kilimanjaro|아루샤|Arusha|탄자니아|Tanzania|케냐|Kenya|남아공|South\s*Africa/i.test(
      joinedBlob,
    )
  ) {
    return 'africa_safari'
  }
  if (
    /인스부르크|Innsbruck|노르트케테|Nordkette|스와로브스키|Swarovski|잘츠부르크|Salzburg|할슈타트|Hallstatt|오스트리아|Austria/i.test(
      joinedBlob,
    )
  ) {
    return 'austria_alps'
  }
  if (
    /리마|Lima|쿠스코|Cusco|마추픽추|Machu\s*Picchu|라파즈|La\s*Paz|우유니|Uyuni|이과수|Iguazu|남미|페루|Peru|볼리비아|아르헨|칠레|부에노스|파타고니아/i.test(
      joinedBlob,
    )
  ) {
    return 'south_america'
  }
  if (/비엔티엔|Vientiane|방비엥|Vang\s*Vieng|라오스|Laos|왓시사켓|까오삐약/i.test(joinedBlob)) {
    return 'laos_mekong'
  }
  if (
    /바르셀로나|Barcelona|마드리드|Madrid|세비야|Seville|그라나다|Granada|톨레도|Toledo|몬세라트|Montserrat|알함브라|Alhambra|스페인|Spain/i.test(
      joinedBlob,
    )
  ) {
    return 'spain_iberia'
  }
  if (
    /리스본|Lisbon|포르투|Porto|알부페이라|포르티망|베나길|까보다로까|벨렘|포르투갈|Portugal/i.test(
      joinedBlob,
    )
  ) {
    return 'portugal_atlantic'
  }
  if (/단수이|홍마오|타이베이|Taipei|대만|Taiwan|지우펀|예류|화련/i.test(joinedBlob)) {
    return 'taiwan_island'
  }
  if (/울란바타르|Ulaanbaatar|테렐지|Terelj|몽골|Mongolia|톨강/i.test(joinedBlob)) {
    return 'mongolia_steppe'
  }
  if (
    /므츠헤타|Mtskheta|아나누리|Ananuri|트빌리시|Tbilisi|예레반|Yerevan|가르니|Garni|게가르드|Geghard|시그나기|Sighnaghi|보드베|Bodbe|조지아|Georgia|아르메니아|Armenia|코카서스|Caucasus/i.test(
      joinedBlob,
    )
  ) {
    return 'caucasus_georgia_armenia'
  }
  if (/바쿠|Baku|셰키|Sheki|고부스탄|쉬르반|아제르|Azerbaijan/i.test(joinedBlob)) {
    return 'caucasus_caspian'
  }
  // UAE는 thailand_bangkok보다 위에서 이미 처리 (아부다비 왕궁≠방콕)
  if (/사이판|Saipan|마나가하|Managaha|새섬|PIC|괌|Guam|투몬/i.test(joinedBlob)) {
    return 'micronesia_islands'
  }
  if (/마나도|Manado|부나켄|Bunaken|코타키나발루|Kota\s*Kinabalu|\bKK\b|썬베거리/i.test(joinedBlob)) {
    return 'sea_diving'
  }
  if (
    /밴프|Banff|재스퍼|Jasper|아이스필드|웰스그레이|브라이덜|밴쿠버|Vancouver|로키|Rockies/i.test(
      joinedBlob,
    )
  ) {
    return 'canada_rockies'
  }
  if (
    /그랜드\s*캐년|Grand\s*Canyon|요세미티|Yosemite|자이언|Zion|브라이스|세도나|모뉴먼트|라스베이거스|미서부/i.test(
      joinedBlob,
    )
  ) {
    return 'us_west_nature'
  }
  if (
    /산토리니|미코노스|아테네|그리스|크레타|지중해|니스|모나코|리비에라|메테오라|델피|미케네|나프플리오|고린도|아라호바|수니온|포세이돈/i.test(
      joinedBlob,
    )
  ) {
    return 'mediterranean_coast'
  }
  if (
    /플리트비체|Plitvice|두브로브니크|Dubrovnik|스플리트|Split|자다르|Zadar|트로기르|크로아티아|Croatia|아드리아/i.test(
      joinedBlob,
    )
  ) {
    return 'croatia_adriatic'
  }
  if (
    /프라하|Prague|Praha|카를\s*교|카를교|체스키|Cesky|천문\s*시계/i.test(joinedBlob)
  ) {
    return 'central_europe_city'
  }
  if (
    /싱가포르|Singapore|가든스|Gardens\s*by|센토사|Sentosa|머라이언|Merlion/i.test(
      joinedBlob,
    )
  ) {
    return 'singapore_city'
  }
  if (
    /자그레브|Zagreb|류블랴나|Ljubljana|베오그라드|Belgrade|사라예보|발칸|Balkan|부다페스트|Budapest/i.test(
      joinedBlob,
    )
  ) {
    return 'balkans_city'
  }
  if (
    /알래스카|Alaska|글래시어\s*베이|Glacier\s*Bay|쥬노|Juneau|케치칸|Ketchikan|내측\s*항로|Inside\s*Passage|크루즈\s*시애틀|시애틀\s*크루즈|시애틀|Seattle|알카이|퍼블릭\s*마켓/i.test(
      joinedBlob,
    )
  ) {
    return 'alaska_cruise'
  }
  if (
    /오슬로|Oslo|베르겐|Bergen|플롬|Flam|피오르드|fjord|코펜하겐|Copenhagen|스톡홀름|Stockholm|헬싱키|Helsinki|탈린|Tallinn|빌뉴스|Vilnius|리가|Riga|바르샤바|Warsaw|빌라누프|Wilanow|북유럽|노르웨이|Sweden|Denmark|Finland|Norway|오르후스|Aarhus|오덴세|Odense|프레이케스톨|Preikestolen|게이랑에르|Geiranger|발트|라트비아|리투아니아|에스토니아/i.test(
      joinedBlob,
    )
  ) {
    return 'nordic_fjord'
  }
  if (
    /카이로|기자|피라미드|스핑크스|룩소르|아스완|아부심벨|카르나크|이집트|Giza|Cairo|Luxor|Aswan|나일|Nile|사카라|멤피스|후르가다|후루가다|Hurghada|덴데라|Dendera/i.test(
      joinedBlob,
    )
  ) {
    return 'egypt_nile'
  }
  if (
    /바라나시|갠지스|사르나트|아르띠\s*뿌자|아르티\s*푸자|Varanasi|Ganges|Sarnath|Ganga\s*Aarti|Banaras/i.test(
      joinedBlob,
    )
  ) {
    return 'india_varanasi'
  }
  if (/카주라호|Khajuraho|서부\s*사원군|동부\s*사원군/i.test(joinedBlob)) {
    return 'india_khajuraho'
  }
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: India golden = Delhi/Agra/Jaipur only — manifest
  if (
    /뉴델리|자이푸르|아그라|타지마할|하와마할|암베르|나하르가르|델리|인도\s*게이트|인디아\s*게이트|인디아게이트|골든\s*트라이앵글|Jaipur|Agra|Taj\s*Mahal|India\s*Gate|Amber\s*Fort|Hawa\s*Mahal|Qutub|꾸뜹|로디가든|악차르담|바하이/i.test(
      joinedBlob,
    )
  ) {
    return 'india_golden'
  }
  if (
    /오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|초원|사막|게르|내몽골|Inner\s*Mongolia|만주리|마트료시카/i.test(
      joinedBlob,
    )
  ) {
    return 'ordos_steppe'
  }
  return null
}

/** lottetour compose 전용 — 공급사 문장 우선, 없으면 route 명소 2~3문장 */
export function composeRegisterScheduleExtendedRegionVibeDescription(
  routePlaces: readonly string[],
  joinedBlob: string,
  day = 2,
  maxDay = 8,
  supplierText?: string | null,
): string | null {
  const blob = String(joinedBlob ?? '').trim() || routePlaces.filter(Boolean).join(' - ')
  if (!blob && !(day === 1 || (maxDay >= 2 && day === maxDay))) return null
  // REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]: 공급사 문장 우선, 없으면 route 명소 2~3문장 — manifest
  return composeRegisterScheduleCharacteristicDescription({
    day,
    maxDay,
    routePlaces,
    joinedBlob: blob,
    supplierText,
  })
}
