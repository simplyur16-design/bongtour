'use client'

import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import OverseasDestinationBriefingMid from '@/components/products/OverseasDestinationBriefingMid'
import OverseasMonthlyCurationMid from '@/components/products/OverseasMonthlyCurationMid'
import type { MonthlyCurationMidPayload } from '@/lib/overseas-cms-public'
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
  /** 서유럽 섹션 상단 목적지 브리핑(선택) */
  overseasEditorialBriefing?: OverseasEditorialBriefingPayload | null
  /** 동유럽 섹션 직후·미주 전, 전폭 1회(데이터 없으면 미렌더) */
  monthlyCurationMid?: MonthlyCurationMidPayload | null
}

const AIR_HOTEL_MISC_SECTION = '기타'

/** browse 라벨만 정리(개행·과도한 길이) — 국가 판별에는 `nationSectionKeyForAirHotelItem` 사용 */
function sanitizeAirHotelBrowseLabel(raw: string | null | undefined): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (/[\n\r\t]/.test(t)) return ''
  if (t.length > 80) return ''
  return t
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

function finalAirHotelNationSectionLabel(label: string): string {
  const s = label.trim()
  if (!s || s === AIR_HOTEL_MISC_SECTION) return AIR_HOTEL_MISC_SECTION
  if (AIR_HOTEL_FORBIDDEN_SECTION.has(s)) return AIR_HOTEL_MISC_SECTION
  const low = s.toLowerCase()
  if (AIR_HOTEL_FORBIDDEN_SECTION.has(low)) return AIR_HOTEL_MISC_SECTION
  if (
    /^(동남아|서남아|유럽|미주|오세아니아|북미|남미|동북아|남태평양)(\s|·|･|\/|$)/i.test(s)
  ) {
    return AIR_HOTEL_MISC_SECTION
  }
  if (/[·･]/.test(s)) return AIR_HOTEL_MISC_SECTION
  if (!AIR_HOTEL_KNOWN_SECTION_LABELS.has(s)) return AIR_HOTEL_MISC_SECTION
  return s
}

/** 자유여행 섹션 헤더 전용: 도시·지역·권역 라벨 → 한글 국가명만(매칭 실패·권역·복합 라벨은 기타) */
function nationSectionKeyForAirHotelItem(item: ResultItem): string {
  const raw = sanitizeAirHotelBrowseLabel(item.countryRowLabel)
  const dest = sanitizeAirHotelBrowseLabel(item.primaryDestination)
  const regionMeta = sanitizeAirHotelBrowseLabel(item.primaryRegion)
  const hay = `${raw} ${dest} ${regionMeta}`.trim()
  if (!hay) return AIR_HOTEL_MISC_SECTION

  const buckets: { nation: string; re: RegExp }[] = [
    {
      nation: '괌',
      re: /(?:^|[^\p{L}])(?:괌|구암|guam)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '사이판',
      re: /(?:^|[^\p{L}])(?:사이판|saipan)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '하와이',
      re: /(?:^|[^\p{L}])(?:하와이|honolulu|waikiki|hawaii\b|oahu|maui|kauai)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '일본',
      re: /(?:^|[^\p{L}])(?:도쿄|동경|東京|tokyo|오사카|大阪|osaka|후쿠오카|福岡|fukuoka|삿포로|札幌|sapporo|나고야|名古屋|nagoya|교토|京都|kyoto|요코하마|横浜|yokohama|오키나와|沖縄|okinawa|니가타|新潟|가나자와|金沢|kanazawa|히로시마|広島|hiroshima|센다이|仙台|규슈|九州|간사이|関西|kansai|홋카이도|北海道|hokkaido|도호쿠|東北|간토|関東|kanto|시코쿠|四国|주고쿠|中国地方|일본|日本|japan|nihon|니혼)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '베트남',
      re: /(?:^|[^\p{L}])(?:다낭|da\s*nang|나트랑|nha\s*trang|호치민|hcm|hcmc|saigon|사이공|하노이|hanoi|푸꾸옥|phu\s*quoc|호이안|hoi\s*an|달랏|dalat|무이네|hue|후에|퀴논|베트남|vietnam|비엣남)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '태국',
      re: /(?:^|[^\p{L}])(?:방콕|bangkok|푸켓|phuket|치앙마이|chiang\s*mai|파타야|pattaya|코\s*사무이|koh\s*samui|사무이|끄라비|krabi|후아힌|hua\s*hin|카오락|khao\s*lak|태국|thailand|krung)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '싱가포르',
      re: /(?:^|[^\p{L}])(?:싱가포르|싱가폴|singapore)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '대만',
      re: /(?:^|[^\p{L}])(?:대만|臺灣|台湾|타이베이|taipei|타이페이|타이중|taichung|가오슝|kaohsiung|타이난|tainan|화련|hualien|타이완|taiwan)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '필리핀',
      re: /(?:^|[^\p{L}])(?:세부|cebu|마닐라|manila|보홀|bohol|보라카이|boracay|팔라완|palawan|필리핀|philippines)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '말레이시아',
      re: /(?:^|[^\p{L}])(?:쿠알라룸푸르|kuala\s*lumpur|\bkl\b|랑카위|langkawi|페낭|penang|코타키나발루|kota\s*kinabalu|말레이시아|malaysia)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '인도네시아',
      re: /(?:^|[^\p{L}])(?:발리|bali|자카르타|jakarta|롬복|lombok|족자카르타|yogyakarta|jogja|인도네시아|indonesia)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '중국',
      re: /(?:^|[^\p{L}])(?:중국|상해|上海|shanghai|북경|北京|beijing|광저우|广州|guangzhou|심천|shenzhen|청두|成都|chengdu|항저우|杭州|칭다오|青島|qingdao|대련|大连|장가계|zhangjiajie|중화|china)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '홍콩',
      re: /(?:^|[^\p{L}])(?:홍콩|香港|hong\s*kong|hk\b)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '마카오',
      re: /(?:^|[^\p{L}])(?:마카오|澳門|macau|macao)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '호주',
      re: /(?:^|[^\p{L}])(?:호주|australia|시드니|sydney|멜번|melbourne|브리즈번|brisbane|골드코스트|gold\s*coast|퍼스|perth|케인즈|케언즈|cairns)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '뉴질랜드',
      re: /(?:^|[^\p{L}])(?:뉴질랜드|new\s*zealand|오클랜드|auckland|퀸스타운|queenstown|크라이스트처치|christchurch)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '미국',
      re: /(?:^|[^\p{L}])(?:뉴욕|new\s*york|manhattan|\bla\b|로스앤젤레스|los\s*angeles|라스베이거스|las\s*vegas|샌프란시스코|san\s*francisco|시애틀|seattle|마이애미|miami|시카고|chicago|보스턴|boston|워싱턴|washington|올랜도|orlando|필라델피아|philadelphia|미국|usa|united\s*states|america)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '캐나다',
      re: /(?:^|[^\p{L}])(?:캐나다|canada|토론토|toronto|밴쿠버|vancouver|몬트리올|montreal|캘거리|calgary)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '영국',
      re: /(?:^|[^\p{L}])(?:런던|london|맨체스터|manchester|영국|uk\b|britain|스코틀랜드|scotland|에든버러|edinburgh)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '프랑스',
      re: /(?:^|[^\p{L}])(?:파리|paris|니스|nice|리옹|lyon|프랑스|france)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '이탈리아',
      re: /(?:^|[^\p{L}])(?:로마|roma|rome|밀라노|milan|베네치아|venice|피렌체|florence|이탈리아|italy)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '스페인',
      re: /(?:^|[^\p{L}])(?:바르셀로나|barcelona|마드리드|madrid|스페인|spain|그라나다|granada|세비야|seville)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '독일',
      re: /(?:^|[^\p{L}])(?:베를린|berlin|뮌헨|munich|프랑크푸르트|frankfurt|독일|germany)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '스위스',
      re: /(?:^|[^\p{L}])(?:취리히|zurich|제네바|geneva|인터라켄|interlaken|루체른|lucerne|스위스|switzerland)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '튀르키예',
      re: /(?:^|[^\p{L}])(?:이스탄불|istanbul|카파도키아|cappadocia|터키|튀르키예|turkey|türkiye)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '아랍에미리트',
      re: /(?:^|[^\p{L}])(?:두바이|dubai|아부다비|abu\s*dhabi|uae|아랍에미리트|emirates)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '캄보디아',
      re: /(?:^|[^\p{L}])(?:캄보디아|cambodia|앙코르|angkor|씨엠립|siem\s*reap|프놈펜|phnom\s*penh)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '몽골',
      re: /(?:^|[^\p{L}])(?:몽골|mongolia|울란바토르|ulaanbaatar)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '멕시코',
      re: /(?:^|[^\p{L}])(?:멕시코|mexico|칸쿤|cancun|플라야|playa\s*del\s*carmen)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '그리스',
      re: /(?:^|[^\p{L}])(?:그리스|greece|아테네|athens|산토리니|santorini|미코노스|mykonos)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '포르투갈',
      re: /(?:^|[^\p{L}])(?:포르투갈|portugal|리스본|lisbon|포르투|porto)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '네덜란드',
      re: /(?:^|[^\p{L}])(?:암스테르담|amsterdam|네덜란드|netherlands|holland)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '오스트리아',
      re: /(?:^|[^\p{L}])(?:비엔나|vienna|오스트리아|austria|잘츠부르크|salzburg)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '체코',
      re: /(?:^|[^\p{L}])(?:프라하|prague|체코|czech)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '헝가리',
      re: /(?:^|[^\p{L}])(?:부다페스트|budapest|헝가리|hungary)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '크로아티아',
      re: /(?:^|[^\p{L}])(?:두브로브니크|dubrovnik|크로아티아|croatia|스플리트|split)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '이집트',
      re: /(?:^|[^\p{L}])(?:이집트|egypt|카이로|cairo|룩소르|luxor|후르가다|hurghada)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '모로코',
      re: /(?:^|[^\p{L}])(?:모로코|morocco|마라케시|marrakech|카사블랑카|casablanca)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '인도',
      re: /(?:^|[^\p{L}])(?:인도\b|india|델리|delhi|뭄바이|mumbai|아그라|agra|자이푸르|jaipur)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '네팔',
      re: /(?:^|[^\p{L}])(?:네팔|nepal|카트만두|kathmandu)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '스리랑카',
      re: /(?:^|[^\p{L}])(?:스리랑카|sri\s*lanka|콜롬보|colombo)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '라오스',
      re: /(?:^|[^\p{L}])(?:라오스|laos|루앙프라방|luang\s*prabang|비엔티안|vientiane)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '미얀마',
      re: /(?:^|[^\p{L}])(?:미얀마|myanmar|양곤|yangon|바간|bagan)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '스웨덴',
      re: /(?:^|[^\p{L}])(?:스웨덴|sweden|스톡홀름|stockholm)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '노르웨이',
      re: /(?:^|[^\p{L}])(?:노르웨이|norway|오슬로|oslo|베르겐|bergen)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '덴마크',
      re: /(?:^|[^\p{L}])(?:덴마크|denmark|코펜하겐|copenhagen)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '핀란드',
      re: /(?:^|[^\p{L}])(?:핀란드|finland|헬싱키|helsinki|로바니에미|rovaniemi)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '벨기에',
      re: /(?:^|[^\p{L}])(?:벨기에|belgium|브뤼셀|brussels|브뤼헤|bruges)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '폴란드',
      re: /(?:^|[^\p{L}])(?:폴란드|poland|바르샤바|warsaw|크라쿠프|krakow)(?:[^\p{L}]|$)/iu,
    },
    {
      nation: '러시아',
      re: /(?:^|[^\p{L}])(?:러시아|russia|모스크바|moscow|상트페테르부르크|st\.?\s*petersburg)(?:[^\p{L}]|$)/iu,
    },
  ]

  for (const { nation, re } of buckets) {
    if (re.test(hay)) return finalAirHotelNationSectionLabel(nation)
  }

  const exactNation = new Set(
    [...AIR_HOTEL_KNOWN_SECTION_LABELS].filter((x) => x !== AIR_HOTEL_MISC_SECTION)
  )
  const rawOnly = raw.trim()
  const destOnly = dest.trim()
  for (const cand of [rawOnly, destOnly]) {
    if (!cand || /[·･/]/.test(cand)) continue
    if (exactNation.has(cand)) return finalAirHotelNationSectionLabel(cand)
  }

  return AIR_HOTEL_MISC_SECTION
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
      const key = nationSectionKeyForAirHotelItem(item)
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
  monthlyCurationMid,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  editorialBriefing: OverseasEditorialBriefingPayload | null | undefined
  monthlyCurationMid: MonthlyCurationMidPayload | null | undefined
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
        return (
          <Fragment key={bucketId}>
            {section}
            {bucketId === 'europe_east' && monthlyCurationMid ? (
              <section className="scroll-mt-4 w-full" aria-label="이번 달 추천 해외여행">
                <OverseasMonthlyCurationMid {...monthlyCurationMid} />
              </section>
            ) : null}
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
  overseasEditorialBriefing = null,
  monthlyCurationMid = null,
}: Props) {
  if (groupAirHotelByCountry && items.length > 0) {
    return <AirHotelCountryGroupedList items={items} formatWon={formatWon} />
  }

  const hasBucketMeta = items.some((i) => i.overseasBucket != null || i.countryRowLabel != null)
  const useGrouped =
    groupOverseasByRegion &&
    (hasBucketMeta ||
      monthlyCurationMid != null ||
      overseasEditorialBriefing != null)

  if (useGrouped) {
    return (
      <OverseasRegionGroupedList
        items={items}
        formatWon={formatWon}
        editorialBriefing={overseasEditorialBriefing}
        monthlyCurationMid={monthlyCurationMid}
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
