'use client'

import Link from 'next/link'
import ProductDetailNavLink from '@/components/products/ProductDetailNavLink'
import { productDetailCardPreviewFromResultItem } from '@/lib/product-detail-card-preview-from-item'
import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react'
import EsimProductListNativeCard from '@/app/components/travel/EsimProductListNativeCard'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'
import ProductHubSectionGallery from '@/components/products/ProductHubSectionGallery'
import HorizontalScrollWithArrows from '@/components/ui/HorizontalScrollWithArrows'
import OverseasDestinationBriefingMid from '@/components/products/OverseasDestinationBriefingMid'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  OVERSEAS_DISPLAY_BUCKET_LABEL,
  OVERSEAS_DISPLAY_BUCKET_ORDER,
  type OverseasDisplayBucketId,
} from '@/lib/overseas-display-buckets'
import {
  megaMenuRegionTabLabel,
  megaMenuSubgroupLabelsInOrder,
  resolveOverseasMegaMenuSubgroupLabelForClient,
} from '@/lib/overseas-mega-region-city-group'
import PublicImageBottomOverlay from '@/app/components/ui/PublicImageBottomOverlay'
import SafeImage from '@/app/components/SafeImage'
import { isSrcOptimizableByNextImage } from '@/lib/is-src-optimizable-by-next-image'
import { PRODUCT_CARD_IMAGE_BLUR_DATA_URL } from '@/lib/product-card-image-blur'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { interleaveProductsBySupplier } from '@/lib/interleave-products-by-supplier'
import {
  AIR_HOTEL_REGION_SECTION_ORDER,
  airHotelRegionLabel,
  resolveAirHotelItemBucket,
} from '@/lib/air-hotel-region-filter'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import {
  matchProductToDomesticNode,
  type DomesticProductMatchInput,
} from '@/lib/match-domestic-product'
import type { BrowseItemFilterMeta } from '@/lib/products-browse-client-sidebar'
import WishlistToggleButton from '@/components/mypage/WishlistToggleButton'
import { HUB_PRODUCT_SCROLL_LI_CLASS } from '@/components/products/hub-product-row-layout'
import {
  MOBILE_HUB_OVERSEAS_SECTION_STACK_CLASS,
  MOBILE_HUB_PRODUCT_ROW_CLASS,
  MOBILE_HUB_SECTION_STACK_CLASS,
} from '@/lib/mobile-hub-scroll-layout'
import {
  SPORTS_THEME_TAG_LABELS,
  SPORTS_THEME_TAG_VALUES,
  type SportsThemeTag,
} from '@/lib/product-listing-kind'

export type ResultItem = {
  id: string
  /** 공개 URL slug — 있으면 canonical `/products/{slug}` */
  slug?: string | null
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
  /** browse API — 출발일 정렬·필터용 */
  earliestDeparture?: string | null
  /** 해외·항공+호텔 허브 클라이언트 sidebar 필터용 */
  browseFilterMeta?: BrowseItemFilterMeta
  /** modetour 긴급모객 — browse API가 hasUrgentDeal=true일 때만 채움 */
  hasUrgentDeal?: boolean
  urgentDealNextDepartureDate?: string
  urgentDealBaselinePriceKrw?: number
  urgentDealCurrentPriceKrw?: number
  hotelName?: string | null
  hotelGrade?: string | null
  roomType?: string | null
  /** scope=overseas 시 browse API가 채움 */
  overseasBucket?: OverseasDisplayBucketId
  countryRowLabel?: string | null
  /** browse API — 메가메뉴 대분류 하위 지역(그룹) 행 라벨 */
  browseMegaSubgroupLabel?: string | null
  /** browse API — 메가메뉴 대분류 탭 id (`japan`, `southeast-asia` 등) */
  browseMegaRegionTabId?: string | null
  /** DB `Product.country` browse 슬러그 — 항공+호텔 허브 필터 칩용 */
  browseCountry?: string | null
  /** browse API — `Product.sportsThemeTag` (종목별 섹션 그룹용) */
  sportsThemeTags?: SportsThemeTag[]
  /** browse API — 지방·제주 출발 공항 라벨 (인천·김포는 null) */
  departureAirportLabelDisplay?: string | null
  /** 해외 허브 클라이언트 geo 필터 — ProductCountryTag / ProductCityTag */
  countryTags?: Array<{ countryKey: string; nodeKey?: string | null }>
  cityTags?: Array<{ cityKey: string }>
}

/** 해외 목록: 상품 카드 N개마다 eSIM 네이티브 카드 1개 */
const ESIM_NATIVE_INSERT_EVERY = 10

/** 해외·자유여행 허브: 권역/국가당 한 줄 — compact 가로 스크롤(모바일·데스크톱 공통 ul) */
const countryProductRowClass = MOBILE_HUB_PRODUCT_ROW_CLASS

/** 국내 허브 전용 그리드 */
const productCardGridClassDefault = 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

function renderHubSectionGallery(
  items: ResultItem[],
  formatWon: (n: number | null) => string,
  seasonalPickIds: ReadonlySet<string> | null | undefined,
  rotationSeed: number,
  scopeKey: string,
) {
  return (
    <ProductHubSectionGallery
      items={items}
      formatWon={formatWon}
      seasonalPickIds={seasonalPickIds}
      rotationSeed={rotationSeed}
      scopeKey={scopeKey}
    />
  )
}

function sortItemsWithSeasonalPicks(
  items: ResultItem[],
  seasonalPickIds: ReadonlySet<string> | null | undefined,
): ResultItem[] {
  if (!seasonalPickIds || seasonalPickIds.size === 0) return items
  return [
    ...items.filter((p) => seasonalPickIds.has(p.id)),
    ...items.filter((p) => !seasonalPickIds.has(p.id)),
  ]
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
  /** 해외 목록 시즌 정렬 시 `이달의 추천` 배지 대상 */
  seasonalPickIds?: ReadonlySet<string> | null
  /**
   * browse URL `country` 슬러그가 있을 때: 대륙(버킷) 그룹핑 없이 한글 나라명 헤더 + 플랫 그리드.
   * `region`만 있으면 null 유지 → 권역(버킷) 그룹 유지.
   */
  overseasFlatByCountrySlug?: string | null
  /** 해외 여행상품 목록만 — 상품 카드 사이 eSIM 네이티브 카드 삽입 */
  interleaveEsimNativeCards?: boolean
  /** 해외·자유여행 허브 — PC 가로 스크롤 / 모바일 갤러리 (`ProductHubSectionGallery`) */
  hubCompareGridLayout?: boolean
  /** 권역 그룹일 때 섹션당 대표 1+소형 4 미리보기 — 나라·필터 좁히면 해제 */
  hubSectionPreview?: boolean
  /** 새로고침마다 바뀌는 대표 카드 시드 (RSC 전달) */
  hubGalleryRotationSeed?: number
  /** 메가메뉴 대분류만 선택 시 — 도시별 섹션 (`region` 탭 id) */
  megaMenuRegionCityGroupId?: string | null
  /** `region=sports_theme` 전체 — 종목(러닝·트레킹·…)별 섹션 */
  groupSportsThemeByCategory?: boolean
}

function mapFlatListWithEsimCards(
  items: ResultItem[],
  renderProduct: (item: ResultItem) => ReactNode,
  liClassName?: string,
  esimLiClassName?: string,
  opts?: { compactEsim?: boolean },
): ReactNode[] {
  const nodes: ReactNode[] = []
  let sinceEsim = 0
  let esimKey = 0
  const esimCompact = opts?.compactEsim !== false
  for (let i = 0; i < items.length; i++) {
    nodes.push(renderProduct(items[i]))
    sinceEsim++
    if (sinceEsim >= ESIM_NATIVE_INSERT_EVERY && i < items.length - 1) {
      nodes.push(
        <li key={`esim-native-${esimKey++}`} className={esimLiClassName ?? liClassName}>
          <EsimProductListNativeCard compact={esimCompact} />
        </li>,
      )
      sinceEsim = 0
    }
  }
  return nodes
}

function buildProductResultRowNodes(
  items: ResultItem[],
  formatWon: (n: number | null) => string,
  seasonalPickIds: ReadonlySet<string> | null | undefined,
  opts: {
    compact?: boolean
    liClassName?: string
    interleaveEsim?: boolean
  },
): ReactNode[] {
  const liClass = opts.liClassName ?? HUB_PRODUCT_SCROLL_LI_CLASS
  const renderProduct = (item: ResultItem) => (
    <li key={item.id} className={liClass}>
      <ProductResultCard
        item={item}
        formatWon={formatWon}
        seasonalPickBadge={Boolean(seasonalPickIds?.has(item.id))}
        compact={opts.compact}
      />
    </li>
  )
  if (opts.interleaveEsim) {
    return mapFlatListWithEsimCards(items, renderProduct, liClass, undefined, {
      compactEsim: opts.compact,
    })
  }
  return items.map((item) => renderProduct(item))
}

/** 해외·자유여행 허브 — 단일 ul 가로 스크롤 + 좌우 화살표 */
function ProductResultsHubScrollRow({
  ariaLabel,
  children,
}: {
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <HorizontalScrollWithArrows as="ul" scrollClassName={countryProductRowClass} ariaLabel={ariaLabel}>
      {children}
    </HorizontalScrollWithArrows>
  )
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
    re: /도쿄|동경|東京|tokyo|오사카|大阪|osaka|후쿠오카|福岡|fukuoka|삿포로|札幌|sapporo|나고야|名古屋|nagoya|교토|京都|kyoto|요코하마|横浜|yokohama|오키나와|沖縄|okinawa|니가타|新潟|가나자와|金沢|kanazawa|히로시마|広島|hiroshima|센다이|仙台|마츠야마|마쓰야마|matsuyama|규슈|九州|간사이|関西|kansai|홋카이도|北海道|hokkaido|도호쿠|東北|간토|関東|kanto|시코쿠|四国|주고쿠|中国地方|일본|日本|\bjapan\b|nihon|니혼/i,
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
    re: /북인도|남인도|서인도|north\s*india|인도\b|india|델리|delhi|뭄바이|mumbai|아그라|agra|타지마할|taj\s*mahal|자이푸르|jaipur|바라나시|varanasi|골든트라이앵글|golden\s*triangle|갠지스|ganges|라다크|ladakh|라자스탄|rajasthan/i,
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
  seasonalPickIds,
  hubCompareGridLayout = false,
  hubSectionPreview = false,
  interleaveEsimNativeCards = false,
  hubGalleryRotationSeed = 0,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  hubCompareGridLayout?: boolean
  hubSectionPreview?: boolean
  interleaveEsimNativeCards?: boolean
  hubGalleryRotationSeed?: number
}) {
  const sections = useMemo(() => {
    const byBucket = new Map<string, ResultItem[]>()
    for (const id of AIR_HOTEL_REGION_SECTION_ORDER) byBucket.set(id, [])
    for (const item of items) {
      const bucketId = resolveAirHotelItemBucket(item.overseasBucket)
      byBucket.get(bucketId)!.push(item)
    }
    return AIR_HOTEL_REGION_SECTION_ORDER.map((bucketId) => ({
      bucketId,
      regionLabel: airHotelRegionLabel(bucketId),
      items: interleaveProductsBySupplier(byBucket.get(bucketId) ?? []),
    })).filter((s) => s.items.length > 0)
  }, [items])

  return (
    <div className={`mt-6 ${MOBILE_HUB_SECTION_STACK_CLASS}`}>
      {sections.map(({ bucketId, regionLabel, items: rowItems }, idx) => {
        if (rowItems.length === 0) return null
        const scopeKey = `air-hotel:${bucketId}`
        return (
          <section key={bucketId} className="scroll-mt-4" aria-labelledby={`air-hotel-sec-${idx}`}>
            <h2
              id={`air-hotel-sec-${idx}`}
              className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
            >
              {regionLabel}
            </h2>
            {hubCompareGridLayout ? (
              renderHubSectionGallery(
                rowItems,
                formatWon,
                seasonalPickIds,
                hubGalleryRotationSeed,
                scopeKey,
              )
            ) : (
              <ProductResultsHubScrollRow ariaLabel={`${regionLabel} 상품`}>
                {buildProductResultRowNodes(rowItems, formatWon, seasonalPickIds, {
                  compact: true,
                  liClassName: HUB_PRODUCT_SCROLL_LI_CLASS,
                  interleaveEsim: interleaveEsimNativeCards,
                })}
              </ProductResultsHubScrollRow>
            )}
          </section>
        )
      })}
    </div>
  )
}

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
  seasonalPickIds,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
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
      {sections.map(({ id, label, items: rowItems }, idx) => {
        if (rowItems.length === 0) return null
        return (
          <section key={id} className="scroll-mt-4" aria-labelledby={`domestic-hub-sec-${idx}`}>
            <h2
              id={`domestic-hub-sec-${idx}`}
              className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
            >
              {label}
            </h2>
            <ul className={productCardGridClassDefault} role="list">
              {rowItems.map((row) => (
                <li key={row.id}>
                  <ProductResultCard
                    item={row}
                    formatWon={formatWon}
                    seasonalPickBadge={Boolean(seasonalPickIds?.has(row.id))}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function ProductResultCard({
  item,
  formatWon,
  seasonalPickBadge = false,
  compact = false,
  featured = false,
  hero = false,
  hubSquareSmall = false,
}: {
  item: ResultItem
  formatWon: (n: number | null) => string
  seasonalPickBadge?: boolean
  compact?: boolean
  /** 허브 갤러리 — 2칸 와이드 셀용 (이미지·타이포 약간 확대) */
  featured?: boolean
  /** 허브 갤러리 — 대분류 대표 카드 (정사각 이미지) */
  hero?: boolean
  /** PC 허브 — 워드 작은 사각형 타일 */
  hubSquareSmall?: boolean
}) {
  const cardSrc = (item.coverImageUrl ?? item.bgImageUrl ?? '').trim()
  const cardBlur = Boolean(cardSrc) && isSrcOptimizableByNextImage(cardSrc)

  const preview = productDetailCardPreviewFromResultItem(item, formatWon)

  return (
    <ProductDetailNavLink
      href={preview.href}
      preview={preview}
      className={
        hubSquareSmall
          ? 'group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md'
          : compact
            ? 'group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md'
            : 'group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md'
      }
    >
      <div
        className={
          hubSquareSmall
            ? 'relative aspect-square w-full overflow-hidden bg-slate-100'
            : compact
              ? 'relative aspect-[4/3] w-full overflow-hidden bg-slate-100'
              : hero
                ? 'relative aspect-square w-full overflow-hidden bg-slate-100'
                : 'relative aspect-video w-full overflow-hidden bg-slate-100'
        }
      >
        {item.hasUrgentDeal &&
        item.urgentDealBaselinePriceKrw != null &&
        item.urgentDealCurrentPriceKrw != null &&
        item.urgentDealCurrentPriceKrw < item.urgentDealBaselinePriceKrw ? (
          // REGRESSION-FREEZE[supplier-urgent-deal-baseline]: browse 카드 긴급모객 리본 — manifest
          <span
            className={
              compact
                ? 'pointer-events-none absolute -left-7 top-3.5 z-20 w-[110px] -rotate-45 bg-[#d9a81e] py-0.5 text-center text-[9px] font-semibold leading-tight text-[#1F1B2D] shadow-sm'
                : 'pointer-events-none absolute -left-9 top-5 z-20 w-[150px] -rotate-45 bg-[#d9a81e] py-1 text-center text-[11px] font-semibold leading-tight text-[#1F1B2D] shadow-sm'
            }
            aria-label="긴급모객"
          >
            긴급모객
          </span>
        ) : null}
        <div
          className={
            hubSquareSmall || compact ? 'absolute right-1 top-1 z-10' : 'absolute right-2 top-2 z-10'
          }
        >
          <WishlistToggleButton
            kind="product"
            id={item.id}
            title={item.title}
            slug={null}
            destination={item.primaryDestination ?? null}
          />
        </div>
        {cardSrc ? (
          <>
            <SafeImage
              src={cardSrc}
              alt=""
              fill
              className="object-cover"
              sizes={
                hubSquareSmall
                  ? '(max-width:1280px) 22vw, 240px'
                  : compact
                  ? '(max-width:768px) 42vw, (max-width:1024px) 25vw, 20vw'
                  : hero
                    ? '(max-width:768px) 100vw, (max-width:1024px) 50vw, 50vw'
                    : featured
                      ? '(max-width:768px) 100vw, (max-width:1024px) 50vw, 40vw'
                      : '(max-width:768px) 100vw, (max-width:1024px) 50vw, 25vw'
              }
              quality={60}
              {...(cardBlur
                ? { placeholder: 'blur' as const, blurDataURL: PRODUCT_CARD_IMAGE_BLUR_DATA_URL }
                : {})}
            />
            {!compact && !hubSquareSmall ? (
              <PublicImageBottomOverlay
                leftLabel={item.coverImageSeoKeyword ?? null}
                rightLabel={item.coverImageSourceUserLabel ?? null}
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">이미지 없음</div>
        )}
      </div>
      <div
        className={
          hubSquareSmall
            ? 'flex flex-1 flex-col p-1.5'
            : compact
              ? 'flex flex-1 flex-col p-2.5'
              : 'flex flex-1 flex-col p-4'
        }
      >
        {!compact && !hubSquareSmall ? (
          <p className="text-[11px] font-medium text-slate-500">{formatOriginSourceForDisplay(item.originSource)}</p>
        ) : null}
        <div className={compact || hubSquareSmall ? 'mt-0.5' : 'mt-1 flex flex-wrap items-center gap-2'}>
          <h2
            className={
              hubSquareSmall
                ? 'line-clamp-2 min-w-0 text-[9px] font-semibold leading-tight text-slate-900 group-hover:text-teal-800'
                : compact
                ? 'line-clamp-2 min-w-0 text-[11px] font-semibold leading-snug text-slate-900 group-hover:text-teal-800'
                : hero
                  ? 'line-clamp-2 flex-1 min-w-0 text-sm font-bold leading-snug text-slate-900 group-hover:text-teal-800'
                  : featured
                    ? 'line-clamp-2 flex-1 min-w-0 text-[15px] font-bold leading-snug text-slate-900 group-hover:text-teal-800'
                    : 'line-clamp-2 flex-1 min-w-0 text-sm font-semibold text-slate-900 group-hover:text-teal-800'
            }
          >
            {item.title}
          </h2>
          {seasonalPickBadge ? (
            <span
              className={
                compact
                  ? 'mt-0.5 inline-block shrink-0 rounded-full bg-teal-100 px-1.5 py-px text-[9px] text-teal-700'
                  : 'shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700'
              }
            >
              {compact ? '추천' : '이달의 추천'}
            </span>
          ) : null}
        </div>
        {!compact && !hubSquareSmall && item.primaryDestination ? (
          <p className="mt-1 text-xs text-slate-600">{item.primaryDestination}</p>
        ) : null}
        {!compact && !hubSquareSmall && item.departureAirportLabelDisplay ? (
          <p className="mt-0.5 text-xs font-medium text-teal-700">{item.departureAirportLabelDisplay}</p>
        ) : null}
        {!compact &&
        !hubSquareSmall &&
        isAirHotelFreeListingForUi(item.listingKind) &&
        (item.hotelName || item.hotelGrade || item.roomType) ? (
          <p className="mt-1 text-xs text-slate-600">
            {item.hotelName ?? '호텔 정보 확인'}
            {item.hotelGrade ? ` · ${item.hotelGrade}` : ''}
            {item.roomType ? ` · ${item.roomType}` : ''}
          </p>
        ) : null}
        {!compact && !hubSquareSmall && isAirHotelFreeListingForUi(item.listingKind) && item.airportTransferType ? (
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
        ) : null}
        <div
          className={
            hubSquareSmall
              ? 'mt-auto pt-1'
              : compact
                ? 'mt-auto flex flex-wrap items-end justify-between gap-1 pt-2'
                : 'mt-auto flex flex-wrap items-end justify-between gap-2 pt-3'
          }
        >
          {item.hasUrgentDeal &&
          item.urgentDealBaselinePriceKrw != null &&
          item.urgentDealCurrentPriceKrw != null &&
          item.urgentDealCurrentPriceKrw < item.urgentDealBaselinePriceKrw ? (
            <div className="flex flex-col items-start gap-0.5">
              {!compact ? (
                <span className="text-sm font-medium text-red-600 line-through">
                  {formatWon(item.urgentDealBaselinePriceKrw)}
                </span>
              ) : null}
              <div className="flex items-baseline gap-1">
                {!compact ? (
                  <span className="text-sm font-bold text-[#1F1B2D]" aria-hidden>
                    ↓
                  </span>
                ) : null}
                <span
                  className={
                    compact
                      ? 'text-sm font-extrabold tracking-tight text-[#1F1B2D]'
                      : 'text-lg font-extrabold tracking-tight text-[#1F1B2D]'
                  }
                >
                  {formatWon(item.urgentDealCurrentPriceKrw)}
                </span>
              </div>
            </div>
          ) : (
            <span
              className={
                hubSquareSmall
                  ? 'text-[10px] font-bold leading-tight text-slate-900'
                  : compact
                    ? 'text-sm font-bold text-slate-900'
                    : hero
                        ? 'text-base font-extrabold text-slate-900'
                        : featured
                          ? 'text-lg font-extrabold text-slate-900'
                          : 'text-base font-bold text-slate-900'
              }
            >
              {formatWon(item.effectivePricePerPersonKrw)}
            </span>
          )}
          {item.duration ? (
            <span className={compact ? 'text-[10px] text-slate-500' : 'text-xs text-slate-500'}>{item.duration}</span>
          ) : null}
        </div>
      </div>
    </ProductDetailNavLink>
  )
}

function sportsThemeGroupScopeKey(tag: SportsThemeTag): string {
  return `sports-theme:${tag}`
}

function SportsThemeGroupedList({
  items,
  formatWon,
  seasonalPickIds,
  hubCompareGridLayout = false,
  hubGalleryRotationSeed = 0,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  hubCompareGridLayout?: boolean
  hubGalleryRotationSeed?: number
}) {
  const sections = useMemo(() => {
    const byTag = new Map<SportsThemeTag, ResultItem[]>()
    for (const key of SPORTS_THEME_TAG_VALUES) byTag.set(key, [])

    for (const item of items) {
      const tags = item.sportsThemeTags ?? []
      const seen = new Set<SportsThemeTag>()
      for (const raw of tags) {
        if (!SPORTS_THEME_TAG_VALUES.includes(raw as SportsThemeTag)) continue
        const tag = raw as SportsThemeTag
        if (seen.has(tag)) continue
        seen.add(tag)
        byTag.get(tag)!.push(item)
      }
    }

    return SPORTS_THEME_TAG_VALUES.map((tag) => ({
      tag,
      label: SPORTS_THEME_TAG_LABELS[tag],
      items: interleaveProductsBySupplier(
        sortItemsWithSeasonalPicks(byTag.get(tag) ?? [], seasonalPickIds),
      ),
    })).filter((section) => section.items.length > 0)
  }, [items, seasonalPickIds])

  return (
    <div className={`mt-6 ${MOBILE_HUB_OVERSEAS_SECTION_STACK_CLASS}`}>
      {sections.map(({ tag, label, items: sectionItems }) => (
        <section
          key={tag}
          className="scroll-mt-4"
          aria-labelledby={`sports-theme-section-${sportsThemeGroupScopeKey(tag)}`}
        >
          <h2
            id={`sports-theme-section-${sportsThemeGroupScopeKey(tag)}`}
            className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
          >
            {label}
          </h2>
          {hubCompareGridLayout ? (
            renderHubSectionGallery(
              sectionItems,
              formatWon,
              seasonalPickIds,
              hubGalleryRotationSeed,
              sportsThemeGroupScopeKey(tag),
            )
          ) : (
            <ProductResultsHubScrollRow ariaLabel={`스포츠테마 ${label} 상품`}>
              {buildProductResultRowNodes(sectionItems, formatWon, seasonalPickIds, {
                compact: true,
                liClassName: HUB_PRODUCT_SCROLL_LI_CLASS,
              })}
            </ProductResultsHubScrollRow>
          )}
        </section>
      ))}
    </div>
  )
}

function subgroupGroupScopeKey(regionId: string, subgroupLabel: string): string {
  const slug = subgroupLabel
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
  return `mega-subgroup:${regionId}:${slug || 'misc'}`
}

function OverseasMegaRegionSubgroupGroupedList({
  regionId,
  items,
  formatWon,
  seasonalPickIds,
  hubCompareGridLayout = false,
  hubGalleryRotationSeed = 0,
}: {
  regionId: string
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  hubCompareGridLayout?: boolean
  hubGalleryRotationSeed?: number
}) {
  const subgroupOrder = useMemo(() => megaMenuSubgroupLabelsInOrder(regionId), [regionId])

  const itemsWithSubgroup = useMemo(
    () =>
      items.map((item) => {
        const label = (item.browseMegaSubgroupLabel ?? '').trim()
        if (label && label !== '기타') return item
        const resolved = resolveOverseasMegaMenuSubgroupLabelForClient(item, regionId)
        return { ...item, browseMegaSubgroupLabel: resolved }
      }),
    [items, regionId],
  )

  const sections = useMemo(() => {
    const bySubgroup = new Map<string, ResultItem[]>()
    for (const item of itemsWithSubgroup) {
      const key = (item.browseMegaSubgroupLabel ?? '기타').trim() || '기타'
      const list = bySubgroup.get(key) ?? []
      list.push(item)
      bySubgroup.set(key, list)
    }

    const orderedLabels = [
      ...subgroupOrder.filter((label) => (bySubgroup.get(label)?.length ?? 0) > 0),
      ...[...bySubgroup.keys()]
        .filter((label) => !subgroupOrder.includes(label))
        .sort((a, b) => a.localeCompare(b, 'ko')),
    ]

    return orderedLabels.map((subgroupLabel) => ({
      subgroupLabel,
      items: interleaveProductsBySupplier(
        sortItemsWithSeasonalPicks(bySubgroup.get(subgroupLabel) ?? [], seasonalPickIds),
      ),
    }))
  }, [itemsWithSubgroup, subgroupOrder, seasonalPickIds])

  const regionLabel = megaMenuRegionTabLabel(regionId)

  return (
    <div className={`mt-6 ${MOBILE_HUB_OVERSEAS_SECTION_STACK_CLASS}`}>
      {sections.map(({ subgroupLabel, items: subgroupItems }) =>
        subgroupItems.length === 0 ? null : (
          <section
            key={subgroupLabel}
            className="scroll-mt-4"
            aria-labelledby={`overseas-mega-subgroup-${subgroupGroupScopeKey(regionId, subgroupLabel)}`}
          >
            <h2
              id={`overseas-mega-subgroup-${subgroupGroupScopeKey(regionId, subgroupLabel)}`}
              className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
            >
              {subgroupLabel}
            </h2>
            {hubCompareGridLayout ? (
              renderHubSectionGallery(
                subgroupItems,
                formatWon,
                seasonalPickIds,
                hubGalleryRotationSeed,
                subgroupGroupScopeKey(regionId, subgroupLabel),
              )
            ) : (
              <ProductResultsHubScrollRow ariaLabel={`${regionLabel ?? regionId} ${subgroupLabel} 상품`}>
                {buildProductResultRowNodes(subgroupItems, formatWon, seasonalPickIds, {
                  compact: true,
                  liClassName: HUB_PRODUCT_SCROLL_LI_CLASS,
                })}
              </ProductResultsHubScrollRow>
            )}
          </section>
        ),
      )}
    </div>
  )
}

function OverseasRegionGroupedList({
  items,
  formatWon,
  editorialBriefing,
  seasonCurationSlides,
  seasonalPickIds,
  interleaveEsimNativeCards = false,
  hubCompareGridLayout = false,
  hubSectionPreview = false,
  hubGalleryRotationSeed = 0,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  editorialBriefing: OverseasEditorialBriefingPayload | null | undefined
  seasonCurationSlides: HomeSeasonPickDTO[] | null | undefined
  seasonalPickIds?: ReadonlySet<string> | null
  interleaveEsimNativeCards?: boolean
  hubCompareGridLayout?: boolean
  hubSectionPreview?: boolean
  hubGalleryRotationSeed?: number
}) {
  const bucketRowLiClass = HUB_PRODUCT_SCROLL_LI_CLASS

  const interleavedByBucket = useMemo(() => {
    const byBucket = new Map<OverseasDisplayBucketId, ResultItem[]>()
    for (const id of OVERSEAS_DISPLAY_BUCKET_ORDER) byBucket.set(id, [])
    for (const item of items) {
      const bucket: OverseasDisplayBucketId = item.overseasBucket ?? 'other'
      if (!byBucket.has(bucket)) byBucket.set(bucket, [])
      byBucket.get(bucket)!.push(item)
    }
    const out = new Map<OverseasDisplayBucketId, ResultItem[]>()
    for (const bucketId of OVERSEAS_DISPLAY_BUCKET_ORDER) {
      const raw = sortItemsWithSeasonalPicks(byBucket.get(bucketId) ?? [], seasonalPickIds)
      out.set(bucketId, interleaveProductsBySupplier(raw))
    }
    return out
  }, [items, seasonalPickIds])

  return (
    <div className={`mt-6 ${MOBILE_HUB_OVERSEAS_SECTION_STACK_CLASS}`}>
      {OVERSEAS_DISPLAY_BUCKET_ORDER.map((bucketId) => {
        const flatList = interleavedByBucket.get(bucketId) ?? []
        const showEuropeBriefing = bucketId === 'europe_me_af' && editorialBriefing
        const hideSection = flatList.length === 0 && !showEuropeBriefing
        const section = hideSection ? null : (
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
                hubCompareGridLayout ? (
                  renderHubSectionGallery(
                    flatList,
                    formatWon,
                    seasonalPickIds,
                    hubGalleryRotationSeed,
                    bucketId,
                  )
                ) : (
                  <ProductResultsHubScrollRow ariaLabel={`${OVERSEAS_DISPLAY_BUCKET_LABEL[bucketId]} 상품`}>
                    {buildProductResultRowNodes(flatList, formatWon, seasonalPickIds, {
                      compact: true,
                      liClassName: bucketRowLiClass,
                      interleaveEsim: interleaveEsimNativeCards,
                    })}
                  </ProductResultsHubScrollRow>
                )
              ) : flatList.length === 0 && showEuropeBriefing ? (
                <p className="mt-4 text-sm text-slate-500">
                  현재 조건에 맞는 유럽·중동·아프리카 상품이 없습니다.
                </p>
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
  seasonalPickIds = null,
  overseasFlatByCountrySlug = null,
  interleaveEsimNativeCards = false,
  hubCompareGridLayout = false,
  hubSectionPreview = false,
  hubGalleryRotationSeed = 0,
  megaMenuRegionCityGroupId = null,
  groupSportsThemeByCategory = false,
}: Props) {
  if (groupSportsThemeByCategory && items.length > 0) {
    return (
      <SportsThemeGroupedList
        items={items}
        formatWon={formatWon}
        seasonalPickIds={seasonalPickIds}
        hubCompareGridLayout={hubCompareGridLayout}
        hubGalleryRotationSeed={hubGalleryRotationSeed}
      />
    )
  }

  const megaRegionId = (megaMenuRegionCityGroupId ?? '').trim()
  if (megaRegionId && items.length > 0) {
    return (
      <OverseasMegaRegionSubgroupGroupedList
        regionId={megaRegionId}
        items={items}
        formatWon={formatWon}
        seasonalPickIds={seasonalPickIds}
        hubCompareGridLayout={hubCompareGridLayout}
        hubGalleryRotationSeed={hubGalleryRotationSeed}
      />
    )
  }

  if (groupDomesticByRegion && items.length > 0) {
    return <DomesticRegionGroupedList items={items} formatWon={formatWon} seasonalPickIds={seasonalPickIds} />
  }

  if (groupAirHotelByCountry && items.length > 0) {
    return (
      <AirHotelCountryGroupedList
        items={items}
        formatWon={formatWon}
        seasonalPickIds={seasonalPickIds}
        hubCompareGridLayout={hubCompareGridLayout}
        hubSectionPreview={hubSectionPreview}
        interleaveEsimNativeCards={interleaveEsimNativeCards}
        hubGalleryRotationSeed={hubGalleryRotationSeed}
      />
    )
  }

  if (groupOverseasByRegion && items.length > 0) {
    const countrySlugForFlat = (overseasFlatByCountrySlug ?? '').trim().toLowerCase()
    if (countrySlugForFlat) {
      const heading = koreanCountryLabelFromBrowseSlug(countrySlugForFlat) ?? countrySlugForFlat
      return (
        <section className="mt-6 scroll-mt-4" aria-labelledby="overseas-country-flat-heading">
          <h2
            id="overseas-country-flat-heading"
            className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
          >
            {heading}
          </h2>
          {hubCompareGridLayout ? (
            renderHubSectionGallery(
              items,
              formatWon,
              seasonalPickIds,
              hubGalleryRotationSeed,
              `country:${countrySlugForFlat}`,
            )
          ) : (
            <ProductResultsHubScrollRow ariaLabel={`${heading} 상품`}>
              {buildProductResultRowNodes(items, formatWon, seasonalPickIds, {
                compact: true,
                interleaveEsim: interleaveEsimNativeCards,
              })}
            </ProductResultsHubScrollRow>
          )}
        </section>
      )
    }

    return (
      <OverseasRegionGroupedList
        items={items}
        formatWon={formatWon}
        editorialBriefing={overseasEditorialBriefing}
        seasonCurationSlides={overseasSeasonCurationSlides}
        seasonalPickIds={seasonalPickIds}
        interleaveEsimNativeCards={interleaveEsimNativeCards}
        hubCompareGridLayout={hubCompareGridLayout}
        hubSectionPreview={hubSectionPreview}
        hubGalleryRotationSeed={hubGalleryRotationSeed}
      />
    )
  }

  if (hubCompareGridLayout) {
    return renderHubSectionGallery(
      items,
      formatWon,
      seasonalPickIds,
      hubGalleryRotationSeed,
      'hub-flat',
    )
  }

  return (
    <ProductResultsHubScrollRow ariaLabel="상품 목록">
      {buildProductResultRowNodes(items, formatWon, seasonalPickIds, {
        compact: true,
        interleaveEsim: interleaveEsimNativeCards,
      })}
    </ProductResultsHubScrollRow>
  )
}
