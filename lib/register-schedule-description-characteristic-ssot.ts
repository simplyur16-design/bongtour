/**
 * 등록 schedule description — 명소 **특성** 3문장+ (명소명 금지).
 * 일차·동선 해시로 문장을 돌려 같은 템플릿 반복을 막는다.
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]: 3문장+ 특성, 명소명 금지 — manifest
 */

export const REGISTER_SCHEDULE_DESCRIPTION_MAX = 720

export type ScheduleDescFacet =
  | 'arrival'
  | 'return'
  | 'theme_park'
  | 'city_walk'
  | 'heritage'
  | 'viewpoint'
  | 'harbor_coast'
  | 'island'
  | 'nature'
  | 'onsen'
  | 'resort'
  | 'steppe'
  | 'alpine'
  | 'generic'

const FACET_SENTENCES: Record<ScheduleDescFacet, readonly string[]> = {
  arrival: [
    '출발과 입국 수속이 하루의 앞부분을 차지하는 이동 중심 일정입니다.',
    '공항과 시내를 잇는 첫 이동에서 여행의 리듬이 열립니다.',
    '도착 뒤에는 가벼운 적응 동선으로 첫날을 마무리하기 좋습니다.',
    '시차와 이동 피로를 고려해 무리한 체류보다 흐름을 잡는 구성입니다.',
    '앞으로의 일정 밀도를 가늠하며 도시를 처음 스쳐 가는 하루입니다.',
    '입국 뒤 숙소까지 이어지는 동선이 안정적으로 짜여 있습니다.',
    '첫날의 장면은 깊게 머물기보다 방향을 익히는 데 쓰입니다.',
    '이동의 호흡을 낮춘 뒤 거리의 결을 짧게 맛보는 일정입니다.',
  ],
  return: [
    '여정을 정리하고 귀국 항공으로 이어지는 마무리 하루입니다.',
    '별도의 굵은 관광보다 이동과 여운을 남기는 구성입니다.',
    '체크아웃과 공항 동선이 자연스럽게 붙어 부담이 적습니다.',
    '마지막 아침의 리듬을 천천히 낮추며 여행을 닫습니다.',
    '귀국 전까지의 시간이 짧아도 흐름이 끊기지 않게 이어집니다.',
    '짐을 정리한 뒤 이동 중심으로 하루가 단순해집니다.',
    '여운을 남긴 채 귀국길로 연결되는 담백한 일정입니다.',
    '마지막 날의 밀도보다 안정적인 귀가 리듬이 우선입니다.',
  ],
  theme_park: [
    '놀이 시설과 퍼레이드 장면이 하루의 리듬을 이끄는 구성입니다.',
    '짧은 이동 없이 구역을 넘나들며 분위기가 빠르게 바뀌는 하루입니다.',
    '기다리는 시간과 체험이 번갈아 이어져 체감 밀도가 높은 일정입니다.',
    '걷기보다 머무르며 장면을 쌓아 가는 테마파크형 흐름입니다.',
    '낮과 저녁의 조명·음악 결이 달라 여정이 또렷하게 나뉩니다.',
    '동선보다 체류가 중심이 되어 하루가 길게 느껴지는 편입니다.',
    '가족 단위로 속도보다 장면의 밀도를 즐기는 하루입니다.',
    '구역마다 분위기가 바뀌어 같은 공간 안에서도 리듬이 갈립니다.',
  ],
  city_walk: [
    '골목과 상점가·언덕길이 이어지며 걷는 리듬이 하루의 중심입니다.',
    '짧은 구간마다 거리의 밀도와 분위기가 바뀌어 대조가 분명합니다.',
    '현대적 거리와 로컬 골목이 교차해 보는 재미가 쌓입니다.',
    '도보 위주로 장면이 붙어 있어 이동 부담이 적은 구성입니다.',
    '창가·간판·계단의 결이 이어져 도시 감각이 또렷합니다.',
    '번화가와 한적한 골목을 오가며 호흡을 조절하기 좋은 하루입니다.',
    '걷는 속도가 일정 흐름을 잡아 주어 장면이 자연스럽게 붙습니다.',
    '거리의 소음과 여백이 번갈아 나타나 하루의 결이 분명합니다.',
  ],
  heritage: [
    '전통과 신앙의 공간이 이어지며 걸음의 속도가 자연히 느려집니다.',
    '오래된 건축과 마당·향의 분위기가 하루의 결을 만듭니다.',
    '현대 거리와 대비되는 고요한 구역이 리듬을 바꿔 줍니다.',
    '의식과 장식의 디테일을 천천히 보는 구성입니다.',
    '역사의 밀도가 높은 구간이 짧아도 인상이 깊게 남습니다.',
    '경건함과 일상의 소음이 경계를 이루며 장면이 갈립니다.',
    '중세 광장과 성당·성벽의 결이 걷는 하루를 이끕니다.',
    '옛 도시의 층위가 골목마다 다르게 느껴지는 일정입니다.',
  ],
  viewpoint: [
    '고도와 시야가 열리는 지점이 하루의 하이라이트를 만듭니다.',
    '오르내리는 이동 자체가 풍경의 스케일을 바꾸어 줍니다.',
    '도시와 수변이 한눈에 들어오는 조망이 여운을 남깁니다.',
    '짧은 대기 뒤에 펼쳐지는 전망이 동선의 호흡을 잡아 줍니다.',
    '위에서 내려다보는 레이어가 거리 걷기와 대비되어 또렷합니다.',
    '빛과 고도가 바뀌는 순간을 중심으로 하루가 정리됩니다.',
    '전망이 열리는 구간에서 걷는 속도가 자연히 느려집니다.',
    '시야의 깊이가 하루의 밀도를 결정하는 구성입니다.',
  ],
  harbor_coast: [
    '수변과 방파제·해안 바람이 하루의 감각을 이끕니다.',
    '도심과 바다가 맞닿은 구간에서 시야가 갑자기 열립니다.',
    '선착장과 산책로를 오가며 걷는 속도와 풍경의 스케일이 달라집니다.',
    '항구 도시의 밀도와 해안 여백이 교차하는 하루입니다.',
    '물비린내와 바람의 결이 거리 소음과 대비되어 또렷합니다.',
    '수평선이 열리는 순간이 이동보다 인상에 남습니다.',
    '해안 리듬이 도보 구간을 부드럽게 이어 줍니다.',
    '바다와 골목의 대비가 하루의 호흡을 나눠 줍니다.',
  ],
  island: [
    '섬 안의 짧은 이동과 탁 트인 시야가 교차하는 하루입니다.',
    '해안 바람과 마을 골목이 번갈아 나타나 리듬이 가벼워집니다.',
    '다리나 선착장을 넘는 순간부터 풍경의 결이 달라집니다.',
    '체류 밀도가 높아 이동보다 머무르는 감각이 앞섭니다.',
    '섬 특유의 여백이 도심 하루와는 다른 호흡을 만듭니다.',
    '수변과 언덕이 가까워 장면 전환이 빠른 구성입니다.',
    '같은 섬 안에서도 구역마다 분위기가 분명하게 갈립니다.',
    '짧은 동선에도 시야의 스케일이 크게 열리는 하루입니다.',
  ],
  nature: [
    '지형의 스케일이 이동보다 앞서 하루를 이끕니다.',
    '협곡·능선·수면처럼 결이 다른 풍경이 번갈아 나타납니다.',
    '걷는 속도보다 시야가 열리는 순간이 중심인 구성입니다.',
    '대자연의 깊이가 일정 리듬을 천천히 낮춰 줍니다.',
    '풍경의 대비가 분명해 짧은 체류에도 인상이 남습니다.',
    '호수와 숲·바위 지대가 이어져 호흡이 길어지는 하루입니다.',
    '이동 구간조차 풍경의 일부처럼 느껴지는 일정입니다.',
    '지평선이 넓어질수록 하루의 밀도가 담백해집니다.',
  ],
  onsen: [
    '온천 마을 특유의 수증기와 골목 공기가 하루를 감쌉니다.',
    '무거운 이동 없이 머무르며 온도의 변화를 느끼는 구성입니다.',
    '강변과 목욕 리듬이 교차해 여행의 속도를 낮춥니다.',
    '마을 골목의 한적함이 도심 하루와 대비되어 또렷합니다.',
    '뜨거운 기운과 서늘한 산기슭 공기가 번갈아 이어집니다.',
    '체류 중심으로 하루가 짜여 여운이 길게 남습니다.',
    '온천 마을의 저녁 공기가 일정의 결을 부드럽게 닫아 줍니다.',
    '짧은 이동마다 물과 김의 분위기가 장면을 바꿉니다.',
  ],
  resort: [
    '리조트 안팎의 휴양 리듬이 관광 이동보다 앞서는 하루입니다.',
    '해변과 풀사이드처럼 머무르는 장면이 일정의 중심입니다.',
    '이동 부담을 낮추고 감각을 천천히 여는 구성입니다.',
    '여백이 많아 하루의 밀도가 과하지 않게 유지됩니다.',
    '수변의 빛과 바람이 체류 분위기를 이끕니다.',
    '자유 시간의 결이 패키지 동선보다 길게 느껴집니다.',
    '휴식과 짧은 산책이 번갈아 이어지는 리조트형 하루입니다.',
    '풍경을 스치기보다 같은 자리에서 결을 쌓는 일정입니다.',
  ],
  steppe: [
    '초원과 협곡의 스케일이 도시 골목과는 다른 호흡을 만듭니다.',
    '이동마다 지평선이 열려 여정의 크기가 분명해집니다.',
    '건조한 공기와 넓은 시야가 하루의 감각을 이끕니다.',
    '짧은 체류에도 풍경의 대비가 크게 다가오는 구성입니다.',
    '중앙아시아 특유의 광활함이 일정 리듬을 천천히 펼칩니다.',
    '도시 거리와 초원 가장자리가 교차하며 장면이 갈립니다.',
    '지형의 여백이 커질수록 하루가 담백해집니다.',
    '협곡과 초원의 결이 번갈아 나타나 인상이 깊게 남습니다.',
  ],
  alpine: [
    '산자락과 호수 풍경이 이어져 시야가 깊게 열리는 하루입니다.',
    '고도가 바뀔 때마다 공기의 온도와 결이 달라집니다.',
    '설봉과 마을 골목이 대비되어 걷는 리듬이 또렷합니다.',
    '이동보다 풍경이 열리는 순간이 하이라이트가 됩니다.',
    '알프스형 지형의 스케일이 일정 흐름을 이끕니다.',
    '짧은 구간에도 산과 물의 대비가 분명한 구성입니다.',
    '산악 열차나 언덕길의 오르내림이 하루의 호흡을 만듭니다.',
    '호숫가의 고요함과 능선의 개방감이 번갈아 이어집니다.',
  ],
  generic: [
    '하루의 장면이 붙되 명소 나열보다 분위기와 리듬이 중심입니다.',
    '걷는 구간과 머무르는 구간이 번갈아 이어져 호흡이 안정적입니다.',
    '짧은 이동에도 풍경과 거리의 결이 바뀌어 여정이 또렷합니다.',
    '보기와 걷기의 균형이 하루의 밀도를 과하지 않게 유지합니다.',
    '특정 이름을 붙이지 않아도 느껴지는 공간의 성격이 분명합니다.',
    '동선의 앞뒤가 자연스럽게 맞물려 흐름이 끊기지 않습니다.',
    '여백과 밀도가 교차하며 여행의 컨셉이 천천히 쌓입니다.',
    '같은 템포로 반복되지 않게 장면의 결을 바꿔 가는 구성입니다.',
  ],
}

const ATTRACTION_NAME_LEAK_RE =
  /디즈니랜드|디즈니\s*랜드|피크트램|빅토리아\s*피크|헐리우드\s*로드|웡타이신|타이쿤|소호거리|소호\s*거리|미드레벨|에스컬레이터|천문산|원가계|자금성|만리장성|타지마할|콜로세움|에펠|루브르|후지산|후지\s*산/i

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickRotated(pool: readonly string[], seed: number, count: number): string[] {
  if (pool.length === 0 || count <= 0) return []
  const start = seed % pool.length
  const out: string[] = []
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    out.push(pool[(start + i) % pool.length]!)
  }
  return out
}

export function countRegisterScheduleDescriptionSentences(desc: string): number {
  const t = String(desc ?? '').trim()
  if (!t) return 0
  const parts = t
    .split(/(?<=(?:습니다|입니다|됩니다|겁니다|니다|세요|다|요|까)\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
  if (parts.length >= 2) return parts.length
  return t.split(/[.!?。]/).map((s) => s.trim()).filter((s) => s.length >= 8).length
}

export function inferScheduleDescFacets(day: number, maxDay: number, blob: string): ScheduleDescFacet[] {
  const t = String(blob ?? '')
  const facets: ScheduleDescFacet[] = []
  const isLast = maxDay >= 2 && day === maxDay
  const isFirst = day === 1

  if (
    isLast &&
    /인천|김포|GMP|\bICN\b|귀국|출국|귀국길/i.test(t) &&
    !/디즈니|테마파크|사원|피크|소호|박물관|온천|협곡/i.test(t)
  ) {
    facets.push('return')
  }
  if (/디즈니|Disney|유니버설|Universal\s*Studios|테마파크|에버랜드/i.test(t)) {
    facets.push('theme_park')
  }
  if (/피크|Peak|산정|전망대|트램|케이블카|노르트케테|융프라우/i.test(t) && !facets.includes('theme_park')) {
    facets.push('viewpoint')
  }
  if (
    /소호|골목|거리|로드|워킹|도보|센트럴|미드|상점가|번화가|구시가지|광장/i.test(t) &&
    !facets.includes('theme_park')
  ) {
    facets.push('city_walk')
  }
  if (/사원|신사|궁|성당|사찰|왕궁|유적|요새|성곽|신전|박물관/i.test(t) && !facets.includes('theme_park')) {
    facets.push('heritage')
  }
  if (/온천|유후인|벳푸|하코네|기노사키|죠잔케이|쿠사츠/i.test(t)) {
    facets.push('onsen')
  }
  if (/란타우|섬\b|Island|보홀|세부|푸꾸옥|몰디브|Maldives|오아후|하와이/i.test(t)) {
    facets.push('island')
  }
  if (/항구|해안|하버|Harbor|해변|비치|선착장|부두|걸프|아드리아/i.test(t)) {
    facets.push('harbor_coast')
  }
  if (/국립공원|협곡|기암|초원|사막|피오르드|빙하|폭포|호수|록키|사파리/i.test(t)) {
    facets.push('nature')
  }
  if (/알프스|설봉|산자락|융프라우|체르마트|인터라켄|할슈타트/i.test(t)) {
    facets.push('alpine')
  }
  if (/몰디브|Maldives|리조트|비치\s*빌라|풀사이드|자유\s*일정|휴양/i.test(t)) {
    facets.push('resort')
  }
  if (/초원|스텝|게르|차른|알마티|오르도스|몽골/i.test(t)) {
    facets.push('steppe')
  }
  if (isFirst && !facets.includes('theme_park') && /인천|김포|ICN|출발|입국|공항/i.test(t)) {
    facets.unshift('arrival')
  }
  if (facets.length === 0) {
    if (isLast) facets.push('return')
    else if (isFirst) facets.push('arrival')
    else facets.push('generic')
  }
  const uniq: ScheduleDescFacet[] = []
  for (const f of facets) {
    if (!uniq.includes(f)) uniq.push(f)
  }
  return uniq.slice(0, 3)
}

function placeLeakChunks(label: string): string[] {
  const bare = String(label ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!bare) return []
  const chunks = bare
    .split(/[,，·/]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return [...new Set([bare, ...chunks])]
}

export function registerScheduleDescriptionHasAttractionNameLeak(
  desc: string,
  routePlaces: readonly string[] = [],
): boolean {
  const t = String(desc ?? '')
  if (!t) return false
  if (ATTRACTION_NAME_LEAK_RE.test(t)) return true
  for (const p of routePlaces) {
    for (const chunk of placeLeakChunks(p)) {
      if (chunk.length >= 4 && t.includes(chunk)) return true
      if (/[가-힣]{2,}/.test(chunk) && chunk.length >= 2 && t.includes(chunk)) {
        // 1글자 조사 오탐 방지: 2글자 이상 한글 명소명만
        if (chunk.length >= 3) return true
      }
    }
  }
  return false
}

function sentenceMentionsLeak(sent: string, routePlaces: readonly string[]): boolean {
  if (ATTRACTION_NAME_LEAK_RE.test(sent)) return true
  for (const p of routePlaces) {
    for (const chunk of placeLeakChunks(p)) {
      if (chunk.length >= 3 && sent.includes(chunk)) return true
    }
  }
  return false
}

function capAtSentenceBoundary(desc: string, max = REGISTER_SCHEDULE_DESCRIPTION_MAX): string {
  const t = desc.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const parts = t
    .split(/(?<=(?:습니다|입니다|됩니다|겁니다|니다|세요|다|요|까)\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  let acc = ''
  for (const p of parts) {
    const next = acc ? `${acc} ${p}` : p
    if (next.length > max) break
    acc = next
  }
  return (acc || t.slice(0, max)).trim()
}

/**
 * 일정요약 SSOT — 3문장 이상, 명소 특성만. 명소명·generic 마커 금지.
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]
 */
export function composeRegisterScheduleCharacteristicDescription(opts: {
  day: number
  maxDay: number
  routePlaces: readonly string[]
  joinedBlob: string
  regionSentences?: readonly string[] | null
}): string {
  const day = Math.max(1, Math.floor(Number(opts.day) || 1))
  const maxDay = Math.max(day, Math.floor(Number(opts.maxDay) || day))
  const blob = String(opts.joinedBlob ?? '').trim() || opts.routePlaces.filter(Boolean).join(' - ')
  const facets = inferScheduleDescFacets(day, maxDay, blob)
  const seed =
    day * 37 +
    maxDay * 13 +
    hashSeed(`${facets.join(',')}|${blob.slice(0, 96)}|${(opts.regionSentences ?? []).join('').slice(0, 24)}`)

  const region = (opts.regionSentences ?? []).filter((s) => s && !sentenceMentionsLeak(s, opts.routePlaces))
  const facetPool = facets
    .flatMap((f) => [...FACET_SENTENCES[f]])
    .filter((s) => !sentenceMentionsLeak(s, opts.routePlaces))

  const picked: string[] = []
  const tryAdd = (s: string | undefined) => {
    if (!s || picked.includes(s) || sentenceMentionsLeak(s, opts.routePlaces)) return
    picked.push(s)
  }

  if (region.length > 0) {
    const n = region.length >= 4 ? 1 : Math.min(2, region.length)
    for (const s of pickRotated(region, seed, region.length)) {
      if (picked.filter((x) => region.includes(x)).length >= n) break
      tryAdd(s)
    }
  }
  const leadFacets: ScheduleDescFacet[] = ['theme_park', 'resort', 'onsen', 'return', 'arrival']
  for (const f of facets) {
    if (!leadFacets.includes(f)) continue
    tryAdd(FACET_SENTENCES[f][0])
  }
  const fillPool = facetPool.length > 0 ? facetPool : [...FACET_SENTENCES.generic]
  for (const s of pickRotated(fillPool, seed + 41, fillPool.length)) {
    if (picked.length >= 3) break
    tryAdd(s)
  }
  if (picked.length < 3) {
    for (const s of FACET_SENTENCES.generic) {
      if (picked.length >= 3) break
      tryAdd(s)
    }
  }

  const desc = capAtSentenceBoundary(picked.slice(0, 4).join(' '))
  return desc
}
