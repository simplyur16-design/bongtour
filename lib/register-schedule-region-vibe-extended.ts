/**
 * 확장 지역 vibe 문장 — lottetour 표에 없는 중국·중앙아·미주 등.
 * lottetour와 순환 import 금지용으로 분리.
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
 */

const GENERIC_TOURISM_MARKER = '하루 동안 여러 장면이 자연스럽게 이어지는'

export function isRegisterScheduleGenericTourismDescription(desc: string): boolean {
  return desc.includes(GENERIC_TOURISM_MARKER)
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
  | 'mediterranean_coast'
  | 'croatia_adriatic'
  | 'balkans_city'
  | 'alaska_cruise'
  | 'hokkaido_nature'
  | 'nordic_fjord'
  | 'egypt_nile'
  | 'india_golden'
  | 'ordos_steppe'

const EXTENDED_REGION_VIBE_DESCRIPTIONS: Record<ExtendedRegionVibeProfile, readonly string[]> = {
  china_coastal: [
    '항구 도시와 해변·광장이 이어지는, 바닷바람 리듬의 하루입니다.',
    '짧은 이동마다 시야가 열려, 도심과 해안의 대비를 함께 느끼기 좋은 구성입니다.',
  ],
  china_zhangjiajie: [
    '기암과 협곡이 이어지는 하루로, 풍경의 스케일이 일정 흐름을 이끕니다.',
    '이동보다 시야가 열리는 순간이 중심이 되어 여운이 길게 남는 구성입니다.',
  ],
  china_beijing: [
    '역사 유적과 도심 광장이 이어지는, 수도의 밀도가 돋보이는 하루입니다.',
    '걷는 리듬과 시야 확장이 번갈아 이어져 도시의 결을 천천히 쌓아 갑니다.',
  ],
  china_city_walk: [
    '골목과 거리·광장이 이어지는, 중국 도심의 걷는 리듬이 중심인 하루입니다.',
    '짧은 체류에도 분위기 차이가 분명하게 느껴지는 구성입니다.',
  ],
  japan_onsen_town: [
    '온천 마을과 거리 풍경이 이어지는, 차분한 일본의 하루입니다.',
    '무거운 이동 없이 주변 분위기를 천천히 음미하며 호흡을 고르는 일정입니다.',
  ],
  japan_city_walk: [
    '신사·상점가·골목이 이어지는, 걷는 즐거움이 중심인 하루입니다.',
    '도심의 리듬에 맞춰 장면이 자연스럽게 바뀌는 알찬 구성입니다.',
  ],
  thailand_bangkok: [
    '왕궁·사원·수변이 이어지는, 방콕의 밀도가 느껴지는 하루입니다.',
    '도심을 가로지르며 전통과 현대의 대비를 함께 담는 구성입니다.',
  ],
  thailand_beach: [
    '섬과 해안이 이어지는, 여유로운 남국의 하루입니다.',
    '수상 활동과 해변 리듬이 번갈아 이어져 감각이 또렷해지는 구성입니다.',
  ],
  central_asia_steppe: [
    '초원·협곡·도시 거리가 이어지는, 중앙아시아의 스케일이 돋보이는 하루입니다.',
    '이동마다 풍경의 결이 바뀌어 여정이 분명하게 느껴지는 구성입니다.',
  ],
  canada_rockies: [
    '국립공원과 호수·폭포가 이어지는, 캐나다 록키의 대자연이 중심인 하루입니다.',
    '시야가 열리는 순간이 흐름을 이끌며 여운이 길게 남는 구성입니다.',
  ],
  us_west_nature: [
    '국립공원과 협곡·사막 풍경이 이어지는, 미서부의 스케일이 돋보이는 하루입니다.',
    '이동보다 풍경의 대비가 중심이 되어 하루의 리듬이 또렷합니다.',
  ],
  mediterranean_coast: [
    '해안과 마을·유적이 이어지는, 지중해 연안의 여유로운 하루입니다.',
    '바다와 골목의 대비가 시야를 넓히며 걷는 즐거움이 흐름의 중심이 됩니다.',
  ],
  croatia_adriatic: [
    '아드리아 해안과 성벽·국립공원이 이어지는, 크로아티아의 풍경이 중심인 하루입니다.',
    '이동마다 시야가 열려 바다와 돌마을의 대비가 분명하게 느껴지는 구성입니다.',
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
    '짧은 이동마다 풍경의 결이 바뀌어 여정이 또렷하게 느껴지는 구성입니다.',
  ],
  nordic_fjord: [
    '피오르드와 항구·구시가지가 이어지는, 북유럽의 시야가 열리는 하루입니다.',
    '이동과 풍경의 대비가 분명해 여정의 호흡이 길게 남는 구성입니다.',
  ],
  egypt_nile: [
    '신전과 나일 강변·사막 풍경이 이어지는, 이집트의 스케일이 중심인 하루입니다.',
    '유적과 이동의 리듬이 번갈아 이어져 여운이 길게 남는 구성입니다.',
  ],
  india_golden: [
    '요새와 사원·광장이 이어지는, 인도 골든트라이앵글의 밀도가 돋보이는 하루입니다.',
    '걷는 리듬과 시야 확장이 번갈아 이어져 도시의 결을 천천히 쌓아 갑니다.',
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
  if (/돗토리|유후인|벳푸|온천|kusatsu|하코네|기노사키|아타미/i.test(joinedBlob)) {
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
  if (/교토|오사카|도쿄|도톤보리|기요미즈|아라시야마|닛코|가나자와|일본/i.test(joinedBlob)) {
    return 'japan_city_walk'
  }
  if (/파타야|니모|스노클|푸켓|사무이|크라비|해변|비치|섬\s*투어/i.test(joinedBlob)) {
    return 'thailand_beach'
  }
  if (/방콕|왕궁|에메랄드|수상가옥|짜오프라야|아시아티크|농눅/i.test(joinedBlob)) {
    return 'thailand_bangkok'
  }
  if (
    /알마티|침블락|침볼락|차른|콜사이|타슈켄트|사마르칸트|사마르칸|우즈베|카자흐|키르기스|중앙아시아|비슈케크|아프로시압|울루그벡|구르\s*아미르|레기스탄|젠코바|판필로바|이식쿨|알라아르차/i.test(
      joinedBlob,
    )
  ) {
    return 'central_asia_steppe'
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
    /오슬로|Oslo|베르겐|Bergen|플롬|Flam|피오르드|fjord|코펜하겐|Copenhagen|스톡홀름|Stockholm|헬싱키|Helsinki|탈린|Tallinn|빌뉴스|Vilnius|북유럽|노르웨이|Sweden|Denmark|Finland|Norway|오르후스|Aarhus|오덴세|Odense|프레이케스톨|Preikestolen|게이랑에르|Geiranger/i.test(
      joinedBlob,
    )
  ) {
    return 'nordic_fjord'
  }
  if (
    /카이로|기자|피라미드|스핑크스|룩소르|아스완|아부심벨|카르나크|이집트|Giza|Cairo|Luxor|Aswan|나일|Nile|사카라|멤피스/i.test(
      joinedBlob,
    )
  ) {
    return 'egypt_nile'
  }
  if (
    /뉴델리|자이푸르|아그라|타지마할|하와마할|암베르|델리|인도\s*게이트|골든\s*트라이앵글|Jaipur|Agra|Taj\s*Mahal/i.test(
      joinedBlob,
    )
  ) {
    return 'india_golden'
  }
  if (
    /오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|초원|사막|게르|내몽골|Inner\s*Mongolia/i.test(joinedBlob)
  ) {
    return 'ordos_steppe'
  }
  return null
}

/** lottetour compose 전용 — 유럽 표 위임 없이 확장 프로필만 */
export function composeRegisterScheduleExtendedRegionVibeDescription(
  routePlaces: readonly string[],
  joinedBlob: string,
): string | null {
  const profile = inferExtendedRegionVibeProfile(joinedBlob)
  if (!profile) return null
  const sentences = [...EXTENDED_REGION_VIBE_DESCRIPTIONS[profile]].slice(0, 2)
  let desc = sentences.join(' ')
  for (const h of routePlaces) {
    const bare = h.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    if (bare.length >= 6 && desc.includes(bare)) {
      const alt = EXTENDED_REGION_VIBE_DESCRIPTIONS[profile].filter((s) => !s.includes(bare))
      desc = (alt.length >= 1 ? alt : sentences).slice(0, 2).join(' ')
      break
    }
  }
  return desc.slice(0, 320).trim()
}
