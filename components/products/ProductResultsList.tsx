'use client'

import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'
import OverseasDestinationBriefingMid from '@/components/products/OverseasDestinationBriefingMid'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  OVERSEAS_DISPLAY_BUCKET_LABEL,
  OVERSEAS_DISPLAY_BUCKET_ORDER,
  type OverseasDisplayBucketId,
} from '@/lib/overseas-display-buckets'
import PublicImageBottomOverlay from '@/app/components/ui/PublicImageBottomOverlay'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { interleaveProductsBySupplier } from '@/lib/interleave-products-by-supplier'
import {
  matchProductToDomesticNode,
  type DomesticProductMatchInput,
} from '@/lib/match-domestic-product'

export type ResultItem = {
  id: string
  title: string
  originSource: string
  productType: string | null
  /** 항공권+호텔(자유여행) 등 — 에어텔 UI 게이트용 */
  listingKind?: string | null
  airportTransferType?: string | null
  primaryDestination: string | null
  primaryRegion?: string | null
  duration: string | null
  bgImageUrl: string | null
  coverImageUrl?: string | null
  coverImageSeoKeyword?: string | null
  coverImageSourceUserLabel?: string | null
  effectivePricePerPersonKrw: number | null
  hotelName?: string | null
  hotelGrade?: string | null
  roomType?: string | null
  /** scope=overseas 시 browse API가 채움 */
  overseasBucket?: OverseasDisplayBucketId
  countryRowLabel?: string | null
}

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  /** `/travel/overseas` 해외 허브만 권역 버킷별 한 줄 목록 */
  groupOverseasByRegion?: boolean
  /** `/travel/air-hotel`만: 국가 단위 섹션(도시 라벨 정규화) + 섹션 내 공급사 interleave */
  groupAirHotelByCountry?: boolean
  /** `/travel/domestic`만: 지역 고정 순서 섹션 + 섹션 내 interleave */
  groupDomesticByRegion?: boolean
  /** 서유럽 섹션 상단 목적지 브리핑(선택) */
  overseasEditorialBriefing?: OverseasEditorialBriefingPayload | null
  /** 해외 허브: 시즌 추천 순환 슬롯 — **일본 섹션 바로 아래** 고정 */
  overseasSeasonCurationSlides?: HomeSeasonPickDTO[] | null | undefined
}

const AIR_HOTEL_MISC_SECTION = '기타'

/** browse 라벨만 정리(개행·과도한 길이) — 카드 부가 표시 등 짧은 라벨용 */
function sanitizeAirHotelBrowseLabel(raw: string | null | undefined): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (/[\n\r\t]/.test(t)) return ''
  if (t.length > 80) return ''
  return t
}

const AIR_HOTEL_TITLE_NATION_MAX = 512
const AIR_HOTEL_BROWSE_NATION_MAX = 160

/**
 * 자유여행 섹션 키 전용 — **title은 길이로 버리지 않음**(긴 제목 끝의 괌/시드니 유지).
 * browse 필드는 과도하게 긴 값만 잘라 쓴다.
 */
function normalizeAirHotelFieldForNation(raw: string | null | undefined, kind: 'title' | 'browse'): string {
  const t = (raw ?? '')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return ''
  const max = kind === 'title' ? AIR_HOTEL_TITLE_NATION_MAX : AIR_HOTEL_BROWSE_NATION_MAX
  return t.length > max ? t.slice(0, max) : t
}

/** browse·트리에서 내려오는 권역/복합 라벨 — 섹션 헤더로 금지 */
const AIR_HOTEL_FORBIDDEN_SECTION = new Set([
  '동남아',
  '서남아',
  '유럽',
  '미주',
  '북미',
  '남미',
  '중남미',
  '아프리카',
  '중동',
  '오세아니아',
  '남태평양',
  '북유럽',
  '서유럽',
  '동유럽',
  '남유럽',
  '스칸디나비아',
  '발트',
  '동북아',
  '아시아',
  '동남아시아',
  '아세안',
  'asean',
  '기타 아시아',
  '대양주',
])

/** 최종 섹션 헤더: 국가명·독립 여행지·기타만(도시·권역 단독 헤더 차단용) */
const AIR_HOTEL_KNOWN_SECTION_LABELS = new Set<string>([
  AIR_HOTEL_MISC_SECTION,
  '괌',
  '사이판',
  '하와이',
  '일본',
  '베트남',
  '태국',
  '싱가포르',
  '대만',
  '필리핀',
  '말레이시아',
  '인도네시아',
  '중국',
  '홍콩',
  '마카오',
  '호주',
  '뉴질랜드',
  '미국',
  '캐나다',
  '영국',
  '프랑스',
  '이탈리아',
  '스페인',
  '독일',
  '스위스',
  '튀르키예',
  '아랍에미리트',
  '캄보디아',
  '몽골',
  '멕시코',
  '그리스',
  '포르투갈',
  '네덜란드',
  '오스트리아',
  '체코',
  '헝가리',
  '크로아티아',
  '이집트',
  '모로코',
  '인도',
  '네팔',
  '스리랑카',
  '라오스',
  '미얀마',
  '스웨덴',
  '노르웨이',
  '덴마크',
  '핀란드',
  '벨기에',
  '폴란드',
  '러시아',
])

/** title·browse 합친 문자열 → 첫 매칭만 최종 섹션 키(괌/호주 등 부분 문자열 허용) */
const AIR_HOTEL_SECTION_RULES: ReadonlyArray<{ key: string; re: RegExp }> = [
  { key: '괌', re: /괌|구암|\bguam\b|tumon|투몬/i },
  { key: '사이판', re: /사이판|\bsaipan\b/i },
  { key: '하와이', re: /하와이|honolulu|waikiki|\bhawaii\b|oahu|maui|kauai/i },
  {
    key: '호주',
    re: /시드니|\bsydney\b|멜번|멜버른|\bmelbourne\b|브리즈번|\bbrisbane\b|골드코스트|gold\s*coast|퍼스|\bperth\b|케인즈|케언즈|\bcairns\b|호주|\baustralia\b/i,
  },
  {
    key: '뉴질랜드',
    re: /뉴질랜드|new\s*zealand|오클랜드|\bauckland\b|퀸스타운|\bqueenstown\b|크라이스트처치|\bchristchurch\b/i,
  },
  {
    key: '일본',
    re: /도쿄|동경|東京|tokyo|오사카|大阪|osaka|후쿠오카|福岡|fukuoka|삿포로|札幌|sapporo|나고야|名古屋|nagoya|교토|京都|kyoto|요코하마|横浜|yokohama|오키나와|沖縄|okinawa|니가타|新潟|가나자와|金沢|kanazawa|히로시마|広島|hiroshima|센다이|仙台|규슈|九州|간사이|関西|kansai|홋카이도|北海道|hokkaido|도호쿠|東北|간토|関東|kanto|시코쿠|四国|주고쿠|中国地方|일본|日本|\bjapan\b|nihon|니혼/i,
  },
  {
    key: '베트남',
    re: /다낭|da\s*nang|나트랑|nha\s*trang|호치민|hcm|hcmc|saigon|사이공|하노이|hanoi|푸꾸옥|phu\s*quoc|호이안|hoi\s*an|달랏|dalat|무이네|hue|후에|퀴논|베트남|vietnam|비엣남/i,
  },
  {
    key: '태국',
    re: /방콕|bangkok|푸켓|phuket|치앙마이|chiang\s*mai|파타야|pattaya|코\s*사무이|koh\s*samui|사무이|끄라비|krabi|후아힌|hua\s*hin|카오락|khao\s*lak|태국|thailand|krung/i,
  },
  { key: '싱가포르', re: /싱가포르|싱가폴|singapore/i },
  {
    key: '대만',
    re: /대만|臺灣|台湾|타이베이|taipei|타이페이|타이중|taichung|가오슝|kaohsiung|타이난|tainan|화련|hualien|타이완|taiwan/i,
  },
  {
    key: '필리핀',
    re: /세부|cebu|마닐라|manila|보홀|bohol|보라카이|boracay|팔라완|palawan|필리핀|philippines/i,
  },
  {
    key: '말레이시아',
    re: /쿠알라룸푸르|kuala\s*lumpur|\bkl\b|랑카위|langkawi|페낭|penang|코타키나발루|kota\s*kinabalu|말레이시아|malaysia/i,
  },
  {
    key: '인도네시아',
    re: /발리|bali|자카르타|jakarta|롬복|lombok|족자카르타|yogyakarta|jogja|인도네시아|indonesia/i,
  },
  {
    key: '중국',
    re: /중국|상해|上海|shanghai|북경|北京|beijing|광저우|广州|guangzhou|심천|shenzhen|청두|成都|chengdu|항저우|杭州|칭다오|青島|qingdao|대련|大连|장가계|zhangjiajie|중화|\bchina\b/i,
  },
  { key: '홍콩', re: /홍콩|香港|hong\s*kong|\bhk\b/i },
  { key: '마카오', re: /마카오|澳門|macau|macao/i },
  { key: '프랑스', re: /파리|paris|니스|\bnice\b|리옹|lyon|프랑스|france/i },
  {
    key: '이탈리아',
    re: /로마|roma|rome|밀라노|milan|베네치아|venice|피렌체|florence|이탈리아|italy/i,
  },
  {
    key: '스페인',
    re: /바르셀로나|barcelona|마드리드|madrid|스페인|spain|그라나다|granada|세비야|seville/i,
  },
  {
    key: '영국',
    re: /런던|london|맨체스터|manchester|영국|\buk\b|britain|스코틀랜드|scotland|에든버러|edinburgh/i,
  },
  {
    key: '캐나다',
    re: /캐나다|canada|토론토|toronto|밴쿠버|vancouver|몬트리올|montreal|캘거리|calgary/i,
  },
  { key: '독일', re: /베를린|berlin|뮌헨|munich|프랑크푸르트|frankfurt|독일|germany/i },
  {
    key: '스위스',
    re: /취리히|zurich|제네바|geneva|인터라켄|interlaken|루체른|lucerne|스위스|switzerland/i,
  },
  {
    key: '튀르키예',
    re: /이스탄불|istanbul|카파도키아|cappadocia|터키|튀르키예|turkey|türkiye/i,
  },
  {
    key: '아랍에미리트',
    re: /두바이|dubai|아부다비|abu\s*dhabi|\buae\b|아랍에미리트|emirates/i,
  },
  {
    key: '캄보디아',
    re: /캄보디아|cambodia|앙코르|angkor|씨엠립|siem\s*reap|프놈펜|phnom\s*penh/i,
  },
  { key: '몽골', re: /몽골|mongolia|울란바토르|ulaanbaatar/i },
  {
    key: '멕시코',
    re: /멕시코|mexico|칸쿤|cancun|플라야|playa\s*del\s*carmen/i,
  },
  {
    key: '그리스',
    re: /그리스|greece|아테네|athens|산토리니|santorini|미코노스|mykonos/i,
  },
  { key: '포르투갈', re: /포르투갈|portugal|리스본|lisbon|포르투|porto/i },
  {
    key: '네덜란드',
    re: /암스테르담|amsterdam|네덜란드|netherlands|holland/i,
  },
  {
    key: '오스트리아',
    re: /비엔나|vienna|오스트리아|austria|잘츠부르크|salzburg/i,
  },
  { key: '체코', re: /프라하|prague|체코|czech/i },
  { key: '헝가리', re: /부다페스트|budapest|헝가리|hungary/i },
  {
    key: '크로아티아',
    re: /두브로브니크|dubrovnik|크로아티아|croatia|스플리트|split/i,
  },
  {
    key: '이집트',
    re: /이집트|egypt|카이로|cairo|룩소르|luxor|후르가다|hurghada/i,
  },
  {
    key: '모로코',
    re: /모로코|morocco|마라케시|marrakech|카사블랑카|casablanca/i,
  },
  {
    key: '인도',
    re: /인도\b|india|델리|delhi|뭄바이|mumbai|아그라|agra|자이푸르|jaipur/i,
  },
  { key: '네팔', re: /네팔|nepal|카트만두|kathmandu/i },
  { key: '스리랑카', re: /스리랑카|sri\s*lanka|콜롬보|colombo/i },
  {
    key: '라오스',
    re: /라오스|laos|루앙프라방|luang\s*prabang|비엔티안|vientiane/i,
  },
  { key: '미얀마', re: /미얀마|myanmar|양곤|yangon|바간|bagan/i },
  { key: '스웨덴', re: /스웨덴|sweden|스톡홀름|stockholm/i },
  { key: '노르웨이', re: /노르웨이|norway|오슬로|oslo|베르겐|bergen/i },
  { key: '덴마크', re: /덴마크|denmark|코펜하겐|copenhagen/i },
  {
    key: '핀란드',
    re: /핀란드|finland|헬싱키|helsinki|로바니에미|rovaniemi/i,
  },
  {
    key: '벨기에',
    re: /벨기에|belgium|브뤼셀|brussels|브뤼헤|bruges/i,
  },
  { key: '폴란드', re: /폴란드|poland|바르샤바|warsaw|크라쿠프|krakow/i },
  {
    key: '러시아',
    re: /러시아|russia|모스크바|moscow|상트페테르부르크|st\.?\s*petersburg/i,
  },
]

/** 괌·사이판·하와이·투몬 등 — 미국 본토 규칙에서 제외 */
const AIR_HOTEL_US_TERRITORY_EXCLUDE_RE =
  /괌|구암|\bguam\b|tumon|투몬|사이판|\bsaipan\b|하와이|\bhawaii\b|honolulu|waikiki|oahu|maui|kauai/i

/** 미국 본토만(요구 단서) — 위 영토 단서가 있으면 적용하지 않음 */
const AIR_HOTEL_US_MAINLAND_RE =
  /뉴욕|new\s*york|manhattan|\bla\b|로스앤젤레스|los\s*angeles|라스베이거스|las\s*vegas|샌프란시스코|san\s*francisco|시애틀|seattle|마이애미|miami|시카고|chicago|보스턴|boston|워싱턴|washington|올랜도|orlando|필라델피아|philadelphia|미국|\busa\b|united\s*states|\bamerica\b/i

const AIR_HOTEL_AUSTRALIA_CONFIRM_RE =
  /시드니|\bsydney\b|멜번|멜버른|\bmelbourne\b|브리즈번|\bbrisbane\b|골드코스트|gold\s*coast|퍼스|\bperth\b|케인즈|케언즈|\bcairns\b|호주|\baustralia\b/i

function airHotelLayerIsOnlyBroadRegionLabel(hay: string): boolean {
  const s = hay.trim()
  if (!s) return true
  if (AIR_HOTEL_FORBIDDEN_SECTION.has(s)) return true
  if (AIR_HOTEL_FORBIDDEN_SECTION.has(s.toLowerCase())) return true
  return /^(동남아|서남아|유럽|미주|북미|남미|중남미|오세아니아|남태평양|대양주|동북아|아시아|동남아시아|기타\s*아시아|아프리카|중동|asean)$/i.test(
    s
  )
}

function finalAirHotelNationSectionLabel(label: string): string {
  const s = label.trim()
  if (!s || s === AIR_HOTEL_MISC_SECTION) return AIR_HOTEL_MISC_SECTION
  if (AIR_HOTEL_FORBIDDEN_SECTION.has(s)) return AIR_HOTEL_MISC_SECTION
  const low = s.toLowerCase()
  if (AIR_HOTEL_FORBIDDEN_SECTION.has(low)) return AIR_HOTEL_MISC_SECTION
  if (
    /^(동남아|서남아|유럽|미주|오세아니아|대양주|북미|남미|동북아|남태평양|기타\s*아시아)(\s|·|･|\/|$)/i.test(
      s
    )
  ) {
    return AIR_HOTEL_MISC_SECTION
  }
  if (/[·･]/.test(s)) return AIR_HOTEL_MISC_SECTION
  if (!AIR_HOTEL_KNOWN_SECTION_LABELS.has(s)) return AIR_HOTEL_MISC_SECTION
  return s
}

/**
 * 자유여행 `/travel/air-hotel` 섹션 키 — **한 함수에서 최종값까지** 결정.
 * 입력 순서: title → primaryDestination → countryRowLabel → primaryRegion (필드당 규칙 순회).
 */
function resolveAirHotelNationSection(item: ResultItem): {
  key: string
  rule: string
  sectionKeyInput: string
} {
  const title = normalizeAirHotelFieldForNation(item.title, 'title')
  const dest = normalizeAirHotelFieldForNation(item.primaryDestination, 'browse')
  const countryRow = normalizeAirHotelFieldForNation(item.countryRowLabel, 'browse')
  const region = normalizeAirHotelFieldForNation(item.primaryRegion, 'browse')
  const sectionKeyInput = [title, dest, countryRow, region].filter(Boolean).join(' | ')

  const layers = [
    { hay: title, name: 'title' },
    { hay: dest, name: 'primaryDestination' },
    { hay: countryRow, name: 'countryRowLabel' },
    { hay: region, name: 'primaryRegion' },
  ] as const

  for (const { hay, name } of layers) {
    if (!hay) continue
    if (airHotelLayerIsOnlyBroadRegionLabel(hay)) continue

    for (const { key, re } of AIR_HOTEL_SECTION_RULES) {
      if (re.test(hay)) {
        return {
          key: finalAirHotelNationSectionLabel(key),
          rule: `regex:${key}@${name}`,
          sectionKeyInput,
        }
      }
    }

    if (!AIR_HOTEL_US_TERRITORY_EXCLUDE_RE.test(hay) && AIR_HOTEL_US_MAINLAND_RE.test(hay)) {
      return {
        key: finalAirHotelNationSectionLabel('미국'),
        rule: `regex:미국@${name}`,
        sectionKeyInput,
      }
    }
  }

  const exactNation = new Set(
    [...AIR_HOTEL_KNOWN_SECTION_LABELS].filter((x) => x !== AIR_HOTEL_MISC_SECTION)
  )
  const combinedForGuards = [title, dest, countryRow, region].filter(Boolean).join(' ')
  for (const cand of [countryRow, dest]) {
    const rawOnly = cand.trim()
    if (!rawOnly || /[·･/]/.test(rawOnly)) continue
    if (AIR_HOTEL_FORBIDDEN_SECTION.has(rawOnly)) continue
    if (!exactNation.has(rawOnly)) continue
    if (rawOnly === '호주') {
      if (AIR_HOTEL_US_TERRITORY_EXCLUDE_RE.test(combinedForGuards)) continue
      if (!AIR_HOTEL_AUSTRALIA_CONFIRM_RE.test(combinedForGuards)) continue
    }
    if (rawOnly === '미국') {
      if (AIR_HOTEL_US_TERRITORY_EXCLUDE_RE.test(combinedForGuards)) continue
      if (!AIR_HOTEL_US_MAINLAND_RE.test(combinedForGuards)) continue
    }
    return {
      key: finalAirHotelNationSectionLabel(rawOnly),
      rule: `exact:${rawOnly}`,
      sectionKeyInput,
    }
  }

  return {
    key: finalAirHotelNationSectionLabel(AIR_HOTEL_MISC_SECTION),
    rule: 'fallback:misc',
    sectionKeyInput,
  }
}

function AirHotelCountryGroupedList({
  items,
  formatWon,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
}) {
  const sections = useMemo(() => {
    const byCountry = new Map<string, ResultItem[]>()
    for (const item of items) {
      const resolved = resolveAirHotelNationSection(item)
      if (process.env.NODE_ENV === 'development') {
        const probe = `${item.title ?? ''}\n${item.primaryDestination ?? ''}\n${item.countryRowLabel ?? ''}\n${item.primaryRegion ?? ''}`
        if (/괌|\bguam\b|시드니|\bsydney\b/i.test(probe)) {
          console.info('[air-hotel-nation]', {
            itemId: item.id,
            title: item.title,
            countryRowLabel: item.countryRowLabel,
            primaryDestination: item.primaryDestination,
            primaryRegion: item.primaryRegion,
            sectionKeyInput: resolved.sectionKeyInput,
            nationSectionKeyForAirHotelItem: resolved.key,
            finalSectionHeader: resolved.key,
            rule: resolved.rule,
          })
        }
      }
      const key = resolved.key
      let arr = byCountry.get(key)
      if (!arr) {
        arr = []
        byCountry.set(key, arr)
      }
      arr.push(item)
    }
    const entries = [...byCountry.entries()].filter(([, list]) => list.length > 0)
    const nonMisc = entries
      .filter(([k]) => k !== AIR_HOTEL_MISC_SECTION)
      .sort((a, b) => {
        const dc = b[1].length - a[1].length
        if (dc !== 0) return dc
        return a[0].localeCompare(b[0], 'ko')
      })
    const misc = entries.find(([k]) => k === AIR_HOTEL_MISC_SECTION)
    const ordered: { countryKey: string; items: ResultItem[] }[] = nonMisc.map(([countryKey, list]) => ({
      countryKey,
      items: interleaveProductsBySupplier(list),
    }))
    if (misc && misc[1].length > 0) {
      ordered.push({ countryKey: misc[0], items: interleaveProductsBySupplier(misc[1]) })
    }
    return ordered
  }, [items])

  return (
    <div className="mt-6 space-y-10">
      {sections.map(({ countryKey, items: rowItems }, idx) => (
        <section key={countryKey} className="scroll-mt-4" aria-labelledby={`air-hotel-sec-${idx}`}>
          <h2
            id={`air-hotel-sec-${idx}`}
            className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
          >
            {countryKey}
          </h2>
          <ul className={cardGridClass} role="list">
            {rowItems.map((item) => (
              <li key={item.id}>
                <ProductResultCard item={item} formatWon={formatWon} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 일반 목록용 그리드 */
const cardGridClass = 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/** 국내 허브 지역 섹션 고정 순서(상품 수와 무관) */
const DOMESTIC_HUB_SECTIONS: { id: string; label: string }[] = [
  { id: 'jeju', label: '제주' },
  { id: 'gangwon', label: '강원' },
  { id: 'gyeongsang', label: '부산/경상' },
  { id: 'jeolla', label: '전라' },
  { id: 'chungcheong', label: '충청' },
  { id: 'capital', label: '수도권' },
  { id: '__etc__', label: '기타' },
]

function domesticTreeGroupToSectionId(gk: string | null | undefined): string {
  if (gk === 'jeju' || gk === 'gangwon' || gk === 'gyeongsang' || gk === 'jeolla' || gk === 'chungcheong' || gk === 'capital') {
    return gk
  }
  return '__etc__'
}

/** 제목 우선 → 트리 매칭(기존 `DOMESTIC_LOCATION_TREE` 규칙 재사용) */
function domesticPublicSectionId(item: ResultItem): string {
  const base: DomesticProductMatchInput = {
    title: item.title,
    originSource: item.originSource,
    primaryDestination: item.primaryDestination,
    primaryRegion: item.primaryRegion,
    destinationRaw: null,
    destination: null,
  }
  const titleOnly = matchProductToDomesticNode({
    ...base,
    primaryDestination: null,
    primaryRegion: null,
  })
  if (titleOnly) return domesticTreeGroupToSectionId(titleOnly.groupKey)
  const full = matchProductToDomesticNode(base)
  return domesticTreeGroupToSectionId(full?.groupKey)
}

function DomesticRegionGroupedList({
  items,
  formatWon,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
}) {
  const sections = useMemo(() => {
    const byId = new Map<string, ResultItem[]>()
    for (const { id } of DOMESTIC_HUB_SECTIONS) byId.set(id, [])
    for (const item of items) {
      const sid = domesticPublicSectionId(item)
      const bucket = byId.get(sid) ?? byId.get('__etc__')!
      bucket.push(item)
    }
    return DOMESTIC_HUB_SECTIONS.map(({ id, label }) => ({
      id,
      label,
      items: interleaveProductsBySupplier(byId.get(id) ?? []),
    })).filter((s) => s.items.length > 0)
  }, [items])

  return (
    <div className="mt-6 space-y-10">
      {sections.map(({ id, label, items: rowItems }, idx) => (
        <section key={id} className="scroll-mt-4" aria-labelledby={`domestic-hub-sec-${idx}`}>
          <h2
            id={`domestic-hub-sec-${idx}`}
            className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
          >
            {label}
          </h2>
          <ul className={cardGridClass} role="list">
            {rowItems.map((row) => (
              <li key={row.id}>
                <ProductResultCard item={row} formatWon={formatWon} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 해외 여행상품: 권역(버킷)당 한 줄 — 약 3장 노출, 나머지는 가로 스크롤(데스크톱에서도 줄바꿈 없음) */
const countryProductRowClass =
  'mt-6 flex flex-nowrap gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain pb-2 pt-0.5 snap-x snap-proximity [-ms-overflow-style:none] [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]'

export function ProductResultCard({
  item,
  formatWon,
}: {
  item: ResultItem
  formatWon: (n: number | null) => string
}) {
  return (
    <Link
      href={`/products/${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        {item.coverImageUrl || item.bgImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote image hosts */}
            <img
              src={item.coverImageUrl ?? item.bgImageUrl ?? ''}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <PublicImageBottomOverlay
              leftLabel={item.coverImageSeoKeyword ?? null}
              rightLabel={item.coverImageSourceUserLabel ?? null}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">이미지 없음</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium text-slate-500">{formatOriginSourceForDisplay(item.originSource)}</p>
        <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-teal-800">
          {item.title}
        </h2>
        {item.primaryDestination && <p className="mt-1 text-xs text-slate-600">{item.primaryDestination}</p>}
        {isAirHotelFreeListingForUi(item.listingKind) && (item.hotelName || item.hotelGrade || item.roomType) && (
          <p className="mt-1 text-xs text-slate-600">
            {item.hotelName ?? '호텔 정보 확인'}
            {item.hotelGrade ? ` · ${item.hotelGrade}` : ''}
            {item.roomType ? ` · ${item.roomType}` : ''}
          </p>
        )}
        {isAirHotelFreeListingForUi(item.listingKind) && item.airportTransferType && (
          <p className="mt-1">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              {item.airportTransferType === 'BOTH'
                ? '픽업·샌딩 포함'
                : item.airportTransferType === 'PICKUP'
                  ? '공항 픽업 포함'
                  : item.airportTransferType === 'SENDING'
                    ? '공항 샌딩 포함'
                    : '공항 이동 불포함'}
            </span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <span className="text-base font-bold text-slate-900">{formatWon(item.effectivePricePerPersonKrw)}</span>
          {item.duration && <span className="text-xs text-slate-500">{item.duration}</span>}
        </div>
      </div>
    </Link>
  )
}

function flattenBucketItems(
  bucketId: OverseasDisplayBucketId,
  bucketToCountries: Map<OverseasDisplayBucketId, Map<string, ResultItem[]>>
): ResultItem[] {
  const countryMap = bucketToCountries.get(bucketId)
  if (!countryMap) return []
  const entries = [...countryMap.entries()].filter(([, list]) => list.length > 0)
  entries.sort(([a], [b]) => a.localeCompare(b, 'ko'))
  return entries.flatMap(([, list]) => list)
}

function OverseasRegionGroupedList({
  items,
  formatWon,
  editorialBriefing,
  seasonCurationSlides,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  editorialBriefing: OverseasEditorialBriefingPayload | null | undefined
  seasonCurationSlides: HomeSeasonPickDTO[] | null | undefined
}) {
  const bucketToCountries = useMemo(() => {
    const map = new Map<OverseasDisplayBucketId, Map<string, ResultItem[]>>()
    for (const id of OVERSEAS_DISPLAY_BUCKET_ORDER) {
      map.set(id, new Map())
    }
    for (const item of items) {
      const bucket: OverseasDisplayBucketId = item.overseasBucket ?? 'other'
      const country = (item.countryRowLabel ?? '기타').trim() || '기타'
      if (!map.has(bucket)) map.set(bucket, new Map())
      const inner = map.get(bucket)!
      if (!inner.has(country)) inner.set(country, [])
      inner.get(country)!.push(item)
    }
    return map
  }, [items])

  const interleavedByBucket = useMemo(() => {
    const out = new Map<OverseasDisplayBucketId, ResultItem[]>()
    for (const bucketId of OVERSEAS_DISPLAY_BUCKET_ORDER) {
      const raw = flattenBucketItems(bucketId, bucketToCountries)
      out.set(bucketId, interleaveProductsBySupplier(raw))
    }
    return out
  }, [bucketToCountries])

  return (
    <div className="mt-6 space-y-12">
      {OVERSEAS_DISPLAY_BUCKET_ORDER.map((bucketId) => {
        const flatList = interleavedByBucket.get(bucketId) ?? []
        const showEuropeBriefing = bucketId === 'europe_west' && editorialBriefing
        const section =
          flatList.length === 0 && !showEuropeBriefing ? null : (
            <section className="scroll-mt-4" aria-labelledby={`overseas-bucket-${bucketId}`}>
              <h2
                id={`overseas-bucket-${bucketId}`}
                className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
              >
                {OVERSEAS_DISPLAY_BUCKET_LABEL[bucketId]}
              </h2>
              {showEuropeBriefing ? (
                <div className="mt-5">
                  <OverseasDestinationBriefingMid {...editorialBriefing} />
                </div>
              ) : null}
              {flatList.length > 0 ? (
                <ul className={countryProductRowClass} role="list">
                  {flatList.map((item) => (
                    <li
                      key={item.id}
                      className="w-[min(17.5rem,calc(100vw-2.75rem))] shrink-0 snap-start sm:w-[min(19rem,calc((100vw-3rem)/2))] lg:w-[calc((100% - 2rem) / 3)] lg:min-w-0 lg:max-w-none"
                    >
                      <ProductResultCard item={item} formatWon={formatWon} />
                    </li>
                  ))}
                </ul>
              ) : showEuropeBriefing ? (
                <p className="mt-4 text-sm text-slate-500">현재 조건에 맞는 서유럽 상품이 없습니다.</p>
              ) : null}
            </section>
          )
        const seasonSlot =
          bucketId === 'japan' && (seasonCurationSlides?.length ?? 0) > 0 ? (
            <div className="scroll-mt-4 w-full">
              <HomeMobileHubSeasonCarousel slides={seasonCurationSlides!} hideHeading />
            </div>
          ) : null

        const japanHeaderOnly =
          bucketId === 'japan' && !section && (seasonCurationSlides?.length ?? 0) > 0 ? (
            <section className="scroll-mt-4" aria-labelledby="overseas-bucket-japan">
              <h2
                id="overseas-bucket-japan"
                className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
              >
                {OVERSEAS_DISPLAY_BUCKET_LABEL.japan}
              </h2>
            </section>
          ) : null

        return (
          <Fragment key={bucketId}>
            {section ?? japanHeaderOnly}
            {seasonSlot}
          </Fragment>
        )
      })}
    </div>
  )
}

export default function ProductResultsList({
  items,
  formatWon,
  groupOverseasByRegion,
  groupAirHotelByCountry = false,
  groupDomesticByRegion = false,
  overseasEditorialBriefing = null,
  overseasSeasonCurationSlides = null,
}: Props) {
  if (groupDomesticByRegion && items.length > 0) {
    return <DomesticRegionGroupedList items={items} formatWon={formatWon} />
  }

  if (groupAirHotelByCountry && items.length > 0) {
    return <AirHotelCountryGroupedList items={items} formatWon={formatWon} />
  }

  const hasBucketMeta = items.some((i) => i.overseasBucket != null || i.countryRowLabel != null)
  const useGrouped =
    groupOverseasByRegion &&
    (hasBucketMeta ||
      (overseasSeasonCurationSlides != null && overseasSeasonCurationSlides.length > 0) ||
      overseasEditorialBriefing != null)

  if (useGrouped) {
    return (
      <OverseasRegionGroupedList
        items={items}
        formatWon={formatWon}
        editorialBriefing={overseasEditorialBriefing}
        seasonCurationSlides={overseasSeasonCurationSlides}
      />
    )
  }

  return (
    <ul className={cardGridClass}>
      {items.map((item) => (
        <li key={item.id}>
          <ProductResultCard item={item} formatWon={formatWon} />
        </li>
      ))}
    </ul>
  )
}
