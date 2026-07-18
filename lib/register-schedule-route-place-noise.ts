/**
 * 등록 schedule routeText 세그먼트 — UI·행정 안내 문구 제외 (전 공급사 공통).
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: manifest
 * REGRESSION-FREEZE[register-schedule-route-text-slot-accuracy]: 비행시간·산문→명소 꼬리 — manifest
 */
import { isAirlineCarrierImageKeyword, isHotelLodgingImageKeyword } from '@/lib/pexels-place-name-keyword'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
const ROUTE_PLACE_NOISE_START_RE =
  /^(?:호텔\s*조식|조식\s*후|중식|석식|자유\s*시간|체크\s*인|체크\s*아웃|공항\s*도착|공항\s*출발|출발|도착|이동|탑승|귀국|투숙|미팅|피켓|입국\s*수속|출국\s*수속)|^[★☆◈◎○]|기상\s*악화|결항|대체|불가할|유의|안내|주의|※|→|특전|시차|국가번호|관광\s*시간|쇼핑점|침향|찻집|라텍스/i

/** 비행·이동 소요 시간 블록 — place 슬롯 아님 */
const ROUTE_FLIGHT_DURATION_BLOCK_RE =
  /\[[^\]\[]{0,120}?(?:약\s*)?\d+\s*시간(?:\s*\d+\s*분)?\s*소요[^\]\[]{0,40}\]/gu

const ROUTE_DURATION_INLINE_RE =
  /(?:^|[:：\s])약\s*\d+\s*시간(?:\s*\d+\s*분)?\s*소요(?:\])?$/u

/** 산문 가이드 문구 → 꼬리 명소만 (문자열에 이미 있는 이름만) */
const ROUTE_PROSE_TAIL_RE =
  /(?:이라?\s*불리우는|이라?\s*불리는?|에\s*위치한|로\s*유명한|가\s*전시된|로\s*손꼽히는|손꼽히는|기념해\s*건설한|한눈에\s*담을\s*수\s*있는|한\s*눈에\s*보이는|맞이해주는|을\s*수\s*있는|을?\s*간직한|에\s*선정된|를?\s*대표하는|대표\s*야시장인|야시장인|로\s*구성된|이\s*보이는|이라는\s*뜻의|이\s*거행된|로\s*사용되고?\s*있는|으로\s*지어진|의\s*명소|만남의\s*장소|으로\s*이루어진|출신의|이\s*어우러진|유물이\s*있는|으로\s*빛나는|꼽히는|상태가\s*뛰어난|볼\s*수\s*있는|동상이\s*있는|선정한|박물관인|먹거리\s*볼거리\s*가득)\s*(.+)$/u

/** 긴 가이드 문장 — 끝 POI 접미사만 남김 */
const ROUTE_GUIDE_POI_TAIL_RE =
  /(?:^|[\s,，])([가-힣A-Za-z][가-힣A-Za-z0-9'\s]{1,28}(?:궁전|궁|성당|대성당|교회|광장|요새|해변|거리|박물관|수도원|국립공원|야시장|사원|성|다리|호수|탑|공원|왕궁|시청))$/u

const ROUTE_POI_TAIL_HINT_RE =
  /(?:궁|성|광장|교회|성당|대성당|해변|거리|요새|박물관|수도원|사원|탑|다리|폭포|공원|성채|왕궁|시청|도서관|온천|항구|섬|호수|마을|요새|절|관|원|야시장|시)$/u

/** 가격·미식·마케팅 수식 — 지명 슬롯 아님 (순수 잡음 문구) */
const ROUTE_PRICE_MEAL_MARKETING_NOISE_RE =
  /비용\s*[:：]?|만원\s*\/?\s*1인|\/\s*1인(?:\s*\()|아동\s*동일|(?:\d+|첫|두|세|네|다섯)\s*번째\s*미식|(?:베트남|로컬)?\s*맛집|^\s*미식\s*$|썬베드|무료\s*이용|(?:분짜|반쎄오|샤브샤브|삼겹살|가정식|쌀국수|갑오징어|BBQ).{0,16}(?:세트|SET)|(?:세트|SET)$|애프터눈\s*티|에프퍼눈\s*티|동양의\s*유럽\s*마을|일정이\s*끝난\s*후|양식\s*SET|한식$|특식$|(?:소고기\s*)?쌀국수|분짜|반쎄오|가정식|갑오징어(?:\s*볶음)?|(?:양식|한식|특식|BBQ)\s*SET|^포함\s*일정$|에어텔\s*특가\s*배너|특가\s*배너|SAIPAN_PIC|PIC_(?:BBQ|전경)|신규\s*사진|200%\s*즐기기|키즈\s*프로그램|슈페리어\s*룸|일\s*2회\s*호텔|호텔소개|객실\s*전경|PIC\s*(?:전경|객실|신규)|반짝반짝\s*별빛|아이\s*러브\s*사이판|사이판\s*추천\s*쇼핑몰|사이판\s*조형물/u

/** 마케팅 접두 — 꼬리 명소만 남기기 전 strip */
const ROUTE_MARKETING_PREFIX_STRIP_RE =
  /^(?:먹거리\s*볼거리\s*가득\s*|바다가\s*보이는\s*|푸꾸옥\s*대표\s*야시장인\s*|대표\s*야시장인\s*)/u

// REGRESSION-FREEZE[lottetour-schedule-route-admin-noise]: 증명서·포함일정·면세품목 route 금지 — manifest
const ROUTE_ADMIN_GUIDANCE_RE =
  /(?:입국|출국|출입국)(?:\s*(?:시|에|할))?[\s\S]{0,24}(?:관련\s*)?안내|관련\s*안내|한국\s*[-·]\s*일본\s*여행|(?:한국|일본)\s*[-·]\s*(?:한국|일본)\s*여행|여행\s*일정|여행\s*(?:입국|출국|시\s*유의)|비자\s*(?:안내|필수|필요)|세관\s*신고|세관에\s*신고|전자\s*입국|Visit\s*Japan|사전\s*동의|유의\s*사항|여행\s*시\s*유의|출입국\s*카드|온라인\s*입국|입국\s*심사|출국\s*심사|전자\s*여권|e\s*TA\b|ESTA|개별\s*수속|미팅\s*없음|영문\s*주민등록|영문\s*가족관계|가족관계\s*증명서|증명서|외국환\s*신고|면세\s*한도|면세\s*가능|가능\s*품목|포함\s*일정|추가금이\s*발생|준비물|협조\s*사항|입국신고서|Arrival\s*Card|반입금지|판매\s*목적의\s*반입|일자별\s*운영시간|작성\s*및\s*제출|제출\s*방법|체류\s*가능\s*기간|입국\s*시\s*동행|필수\s*서류|현지\s*가이드|현지\s*연락처|가이드\s*명|롯데관광\s*단독|한국보다\s*\d+\s*시간|시차|참고\s*URL|https?:|www\./i

const ROUTE_AIRLINE_SEGMENT_RE =
  /^에어[\uAC00-\uD7AF]{1,12}(?:\s*항공)?$|^대한\s*항공$|^아시아나(?:\s*항공)?$|^제주\s*항공$|^진\s*에어$|^티\s*웨이(?:\s*항공)?$|^이스타(?:\s*항공)?$|^에어부산$|^에어\s*프(?:레미아|리미아)(?:\s*항공)?$|^air\s*premia(?:\s*air)?$/iu

const ROUTE_PLACE_LABEL_TRIM_SUFFIX_RE =
  /(?:으로\s*이동|으로?\s*출발|으로?\s*귀국|방문|관광|투어|탐방|체험|승차|하차|탑승|도착|출발|미팅|피켓|조식\s*후|중식\s*후|석식\s*후|시내\s*관광|이동\s*후\s*호텔\s*투숙|호텔\s*투숙|및\s*항구)$/u

const ROUTE_CMS_ASSET_SUFFIX_RE = /-\d{5,}$/i

const ROUTE_MARKETING_EPITHET_RE =
  /(?:땅이\s*끝나고|살고싶어|최고의|휴양지|휴양도시|동화속\s*마을|발현의\s*도시|기도의\s*도시|낭만을|건국의\s*도시|아름다운|천국의|에메랄드|대항해\s*시대|세상의\s*끝|땅끝마을|의\s*도시)/u

/** BongTour 해외 패키지 — routeText는 관광지 체인만. 국내 출발·귀국 허브 제외. */
const REGISTER_SCHEDULE_DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const REGISTER_SCHEDULE_DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

export function isRegisterScheduleDomesticHubRouteSegment(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return false
  if (REGISTER_SCHEDULE_DOMESTIC_HUB_KO_RE.test(t)) return true
  if (REGISTER_SCHEDULE_DOMESTIC_HUB_EN_RE.test(t)) return true
  return false
}

/** 비행 `[인천 - …약 N시간 소요]`·고아 `[` `]` — 세그먼트 분할 전 정리. 도착 도시명은 유지. */
export function stripRegisterScheduleRouteFlightDurationBlocks(routeText: string): string {
  let s = String(routeText ?? '')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")

  s = s.replace(/\[[^\[\]]{0,160}?소요[^\[\]]{0,40}\]/gu, (block) => {
    const inner = block.replace(/^\[|\]$/g, '')
    const recovered: string[] = []
    for (const part of inner.split(/\s+-\s+/)) {
      let p = part.replace(/:\s*약\s*\d+\s*시간(?:\s*\d+\s*분)?\s*소요/gu, '').trim()
      if (!p) continue
      if (isRegisterScheduleDomesticHubRouteSegment(p)) continue
      if (/공항|출발\s*\(|도착\s*\(|약\s*\d|소요|[A-Z]{2}\d{2,4}/u.test(p)) {
        // `프라하 공항` → try city stem
        const stem = p.replace(/\s*(?:국제)?\s*공항.*$/u, '').trim()
        if (
          stem.length >= 2 &&
          !isRegisterScheduleDomesticHubRouteSegment(stem) &&
          !/약\s*\d|소요/u.test(stem)
        ) {
          if (!recovered.includes(stem)) recovered.push(stem)
        }
        continue
      }
      if (!recovered.includes(p)) recovered.push(p)
    }
    return recovered.length ? ` ${recovered.join(' - ')} ` : ' '
  })

  return s
    .replace(/:\s*약\s*\d+\s*시간(?:\s*\d+\s*분)?\s*소요/gu, ' ')
    .replace(/약\s*\d+\s*시간(?:\s*\d+\s*분)?\s*소요/gu, ' ')
    .replace(/\[[^\]]{0,8}\]/g, ' ')
    .replace(/[\[\]]+/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/(?:\s+-\s*){2,}/g, ' - ')
    .replace(/^\s*-\s*|\s*-\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** ITNR·tmTitle 마케팅 접두/접미 제거 — 전 공급사 routeText a–g SSOT */
export function cleanRegisterScheduleRoutePlaceLabel(raw: string): string {
  return String(raw ?? '')
    .replace(/&amp;|&#38;/gi, '&')
    // REGRESSION-FREEZE[register-schedule-route-place-noise]: L&aelig;rdal HTML entity → æ — manifest
    .replace(/&aelig;|&#230;|&#xE6;/gi, 'æ')
    .replace(/&AElig;|&#198;|&#xC6;/g, 'Æ')
    .replace(/^[\s·▪▶●▷\-–—'"]+/, '')
    .replace(/[''"]+$/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, ' ')
    .replace(/▷|■|⭐|🌅|🚙|🚤|🔥/g, ' ')
    .replace(/\[[^\]]{2,64}\]/g, ' ')
    .replace(/[\[\]]+/g, ' ')
    .replace(/\s*\/\/\s*.*$/u, ' ')
    .replace(ROUTE_CMS_ASSET_SUFFIX_RE, '')
    .replace(/\s*\(NEW\)\s*/gi, ' ')
    .replace(/\s*\([A-Z]{2}\d{2,4}\)\s*/g, ' ')
    .replace(ROUTE_DURATION_INLINE_RE, '')
    .replace(ROUTE_MARKETING_PREFIX_STRIP_RE, '')
    // REGRESSION-FREEZE[register-schedule-route-place-noise]: 국가/지역 접두·뷰레스토랑 — manifest
    .replace(
      /^(?:프랑스|이탈리아|독일|스페인|스위스|포르투갈|오스트리아|체코|헝가리|벨기에|네덜란드|튀르키예|터키)\s*[\/／]\s*/u,
      '',
    )
    .replace(/\s*(?:뷰\s*)?레스토랑(?:\s*&?\s*거리)?$/u, '')
    // REGRESSION-FREEZE[register-schedule-route-place-noise]: 터키 체험·이동 꼬리 — manifest
    .replace(/^카라반들의\s*숙소\s*/u, '')
    .replace(/\s*(?:지프\s*차|지프차|카트)$/u, '')
    .replace(/^(이스탄불)\s*(?:이동|야경)$/u, '$1')
    .replace(/^선착장으로\s*이동하여\s*유람선\s*타고\s*/u, '')
    .replace(/^하노이에서\s*가장\s*큰\s*호수\s*[''"]?/u, '서호')
    .replace(/[''"]+$/u, '')
    // REGRESSION-FREEZE[register-schedule-route-place-noise]: 서호서호 중복 붕괴 — manifest
    .replace(/(서호)(?:\s*\1)+/gu, '$1')
    // REGRESSION-FREEZE[register-schedule-route-place-noise]: 야간·일정종료 꼬리 — manifest
    .replace(/\s*야간\s*$/u, '')
    .replace(/\s*일정이\s*끝난\s*후(?:\s*공항)?$/u, '')
    .replace(/\s+/g, ' ')
    .replace(ROUTE_PLACE_LABEL_TRIM_SUFFIX_RE, '')
    .trim()
}

/** 산문 가이드 한 줄에서 꼬리 명소만 추출 (없으면 null) */
export function extractRegisterScheduleProseRoutePlaceTail(raw: string): string | null {
  const t = cleanRegisterScheduleRoutePlaceLabel(raw)
  if (!t || t.length < 4) return null
  const m = t.match(ROUTE_PROSE_TAIL_RE)
  if (m?.[1]) {
    let tail = cleanRegisterScheduleRoutePlaceLabel(m[1])
    if (tail) {
      tail = tail.split(/\s+-\s+/)[0]?.trim() ?? tail
      tail = tail.replace(/\s*(?:등\s*시내|등\s*간단|조망\s*혹은\s*차창).*$/u, '').trim()
      if (tail.length >= 2 && tail.length <= 40 && !isRegisterScheduleRoutePlaceNoise(tail)) {
        if (!(ROUTE_MARKETING_EPITHET_RE.test(tail) && !ROUTE_POI_TAIL_HINT_RE.test(tail))) {
          return tail
        }
      }
    }
  }
  // 긴 가이드 문장 — 끝의 POI만
  if (t.length >= 16) {
    const poi = t.match(ROUTE_GUIDE_POI_TAIL_RE)
    if (poi?.[1]) {
      const tail = cleanRegisterScheduleRoutePlaceLabel(poi[1])
      if (
        tail &&
        tail.length >= 2 &&
        tail.length <= 36 &&
        !isRegisterScheduleRoutePlaceNoise(tail) &&
        !ROUTE_MARKETING_EPITHET_RE.test(tail)
      ) {
        return tail
      }
    }
  }
  return null
}

function isRegisterScheduleMarketingOnlyRouteLabel(t: string): boolean {
  if (!t || t.length > 64) return true
  if (/^(?:땅이\s*끝나고|유럽인들이|작은\s*동화|모든\s*지역)/u.test(t)) return true
  if (/이미지$/u.test(t) && !/(?:궁|성|사원|박물관|수도원|종탑|대성당)/u.test(t)) return true
  if (/입니다[.!]?$|합니다[.!]?$|좋은\s*일정/u.test(t)) return true
  if (ROUTE_MARKETING_EPITHET_RE.test(t) && !/[,，]/.test(t)) return true
  return false
}

function pickRegisterSchedulePlaceAfterComma(t: string): string | null {
  if (!/[,，]/.test(t)) return null
  const parts = t
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const head = parts[0]!
  const tail = parts[parts.length - 1]!
  if (
    head.length >= 10 ||
    ROUTE_MARKETING_EPITHET_RE.test(head) ||
    /(?:의\s*도시|휴양|해변|마을|시대|끝)/u.test(head)
  ) {
    return tail.length >= 2 ? tail : null
  }
  return null
}

/** `도시A 로카곶` 등 한 카드에 붙은 복합 라벨 분리 (2토큰만 — `봉 헤수스 두 몬테 성당` 등 긴 명칭은 유지) */
export function splitRegisterScheduleCompoundRoutePlaceLabel(label: string): string[] {
  const t = cleanRegisterScheduleRoutePlaceLabel(label)
  if (!t) return []
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length !== 2) return [t]
  const m = t.match(
    /^(.{2,28})\s+([가-힣A-Za-z][가-힣A-Za-z\s]{0,22}(?:곶|해변|역|종탑|터미널))$/u,
  )
  if (m?.[1] && m?.[2]) {
    const a = cleanRegisterScheduleRoutePlaceLabel(m[1])
    const b = cleanRegisterScheduleRoutePlaceLabel(m[2])
    if (a && b && a !== b) return [a, b]
  }
  return [t]
}

/** API 카드·tmTitle 한 줄 → routeText 세그먼트 후보 0..n */
export function expandRegisterScheduleRoutePlaceCandidates(raw: string): string[] {
  const segments = String(raw ?? '')
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const parts = segments.length > 1 ? segments : [String(raw ?? '').trim()]
  const out: string[] = []
  for (const part of parts) {
    const label = extractRegisterScheduleRoutePlaceLabel(part)
    if (!label) continue
    for (const piece of splitRegisterScheduleCompoundRoutePlaceLabel(label)) {
      out.push(piece)
    }
  }
  return out
}

/** `메테오라 등 4성호텔` → `메테오라` — routeText·imageKeyword 세그먼트 SSOT */
export function stripRegisterScheduleRouteSegmentLodgingSuffix(seg: string): string {
  return String(seg ?? '')
    .replace(/\s*등\s*\d+\s*성\s*호텔.*$/u, '')
    .replace(/\s*\/\s*(?:준)?\d+\s*성\s*호텔.*$/u, '')
    .replace(/\s*(?:어기|Abbey)\s*호텔.*$/iu, '')
    .replace(/\s*호텔\s*$/u, '')
    .replace(/\s*\(\s*출발\s*전\s*확정\s*\)\s*$/u, '')
    .trim()
}

/** 마케팅 카드명·cms 라벨 → 순수 장소명 (없으면 null) */
export function extractRegisterScheduleRoutePlaceLabel(raw: string): string | null {
  const t0 = cleanRegisterScheduleRoutePlaceLabel(raw)
  if (!t0) return null
  // 산문 덤프 전체가 noise여도 「…이라 불리는 쉔부른궁전」꼬리는 살린다
  if (isRegisterScheduleRoutePlaceNoise(t0)) {
    const fromProseDespiteNoise = extractRegisterScheduleProseRoutePlaceTail(t0)
    if (
      fromProseDespiteNoise &&
      !isRegisterScheduleRoutePlaceNoise(fromProseDespiteNoise) &&
      !isRegisterScheduleMarketingOnlyRouteLabel(fromProseDespiteNoise)
    ) {
      return fromProseDespiteNoise.slice(0, 48)
    }
    return null
  }
  const hotelPoi = t0.match(/^(.{2,32})\s*(?:등\s*\d+\s*성\s*호텔|\/\s*(?:준)?\d+\s*성\s*호텔)/u)
  if (hotelPoi?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(hotelPoi[1].trim())
  }
  if (/등\s*\d+\s*성\s*호텔/u.test(t0) && !/(?:사원|궁|박물관|유적|폭포|성|타워|수도원|대성당)/u.test(t0)) {
    return null
  }

  const moveHotel = t0.match(/^(.{2,32}?)\s*이동\s*후(?:\s*호텔\s*투숙)?$/u)
  if (moveHotel?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(moveHotel[1].trim())
  }
  const beachHarbor = t0.match(/^(.{2,32}?)\s*및\s*항구$/u)
  if (beachHarbor?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(beachHarbor[1].trim())
  }

  // `가이드 미팅 후 호이안 옛도시로 이동` — 미팅 이후 장소만
  const afterGuide = t0.match(/(?:가이드\s*)?(?:미팅|피켓)\s*후\s*(.+)/u)
  if (afterGuide?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(afterGuide[1].trim())
  }

  // `참파 유적지 중 가장 오래된 포나가르 참 사원` → 꼬리 명소
  const oldestPoi = t0.match(/(?:중\s*)?가장\s*오래된\s+(.+)$/u)
  if (oldestPoi?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(oldestPoi[1].trim())
  }

  // `베트남의 민속촌 꾸란마을` → 꾸란마을
  const folkVillage = t0.match(/(?:민속촌|민속\s*마을)\s*(.+)$/u)
  if (folkVillage?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(folkVillage[1].trim())
  }

  // 마케팅 비유만 — 지명 슬롯 거부
  if (/동양의\s*유럽\s*마을/u.test(t0) && !/(?:사원|성당|탑|폭포|공원)/u.test(t0)) {
    return null
  }

  // `호이안 옛도시로 이동` / `호이안 옛도시로` — 조사 로/으로 (도시로 오절단 방지: 캡처 후 재귀)
  const moveParticle = t0.match(/^(.{2,40}?)(?:으로|로)(?:\s*이동)?$/u)
  if (moveParticle?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(moveParticle[1].trim())
  }

  const fairyVillage = t0.match(/동화속\s*마을\s+(.+)$/u)
  if (fairyVillage?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(fairyVillage[1])
  }

  const cityTail = t0.match(/(?:운하)?도시\s+(.{2,28})$/u)
  if (cityTail?.[1] && (t0.length >= 14 || ROUTE_MARKETING_EPITHET_RE.test(t0))) {
    return extractRegisterScheduleRoutePlaceLabel(cityTail[1])
  }

  const fromComma = pickRegisterSchedulePlaceAfterComma(t0)
  if (fromComma) {
    const fromProseOnComma = extractRegisterScheduleProseRoutePlaceTail(fromComma)
    if (fromProseOnComma) return fromProseOnComma.slice(0, 48)
    const cleaned = cleanRegisterScheduleRoutePlaceLabel(fromComma)
    if (cleaned && !isRegisterScheduleRoutePlaceNoise(cleaned) && !isRegisterScheduleMarketingOnlyRouteLabel(cleaned)) {
      return cleaned.slice(0, 48)
    }
  }

  const fromProse = extractRegisterScheduleProseRoutePlaceTail(t0)
  if (fromProse) return fromProse.slice(0, 48)

  // 산문·안내 잔존 — 꼬리 추출 실패 시 슬롯 거부 (지명 슬롯 a–g만)
  if (
    ROUTE_PROSE_TAIL_RE.test(t0) ||
    /손꼽히는|불리우는|불리는|위치한|전시된|기념해\s*건설|간직한|선정된|대표하는|야시장인|이루어진|출신의|유일무이|다채로운|죽기전|어우러진|빛나는|거행되었|만남의\s*장소|먹거리\s*볼거리|등\s*시내|등\s*간단|야경\s*관광|호텔\s*투숙|자유\s*시간|석식\s*$|조식\s*$|전경이\s*한\s*눈에|가이드\s*미팅|미팅\s*장소|하선\s*후|탑승\s*후\s*가이드|무료\s*이용|썬베드|추가금|발생됩니다|준비물|협조\s*사항|개별\s*수속|케이블카\s*탑승\s*후\s*가이드/u.test(
      t0,
    )
  ) {
    return null
  }

  if (isRegisterScheduleMarketingOnlyRouteLabel(t0)) return null
  if (t0.length > 40) return null
  // 긴 가이드 문장(조사·수식어 다수) — POI 접미사 없으면 거부
  if (t0.length > 22 && !ROUTE_POI_TAIL_HINT_RE.test(t0) && /(?:의|를|을|한|된|는|로|과|와)\s/u.test(t0)) {
    return null
  }
  // `항구도시 자다르` → 자다르
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 튀르키예의 수도 앙카라 → 앙카라 — manifest
  const turkeyCapital = t0.match(/^(?:튀르키예|터키)의\s*수도\s+(.{2,24})$/u)
  if (turkeyCapital?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(turkeyCapital[1].trim())
  }
  const harborCity = t0.match(/^(?:항구\s*도시|수도\s*도시|휴양\s*도시)\s+(.{2,24})$/u)
  if (harborCity?.[1]) {
    return extractRegisterScheduleRoutePlaceLabel(harborCity[1].trim())
  }
  return t0.slice(0, 48)
}

/** routeText 세그먼트 — 항공사·캐리어명(관광지 아님) */
export function isRegisterScheduleAirlineRouteSegment(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return false
  if (ROUTE_AIRLINE_SEGMENT_RE.test(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  if (/항공(?:\s*사)?$/u.test(t) && t.length <= 28 && !/(박물관|과학|우주|항공\s*박물관)/u.test(t)) {
    if (/^에어/u.test(t) || isAirlineCarrierImageKeyword(t.replace(/\s*항공$/u, ''))) return true
  }
  return false
}

/** 붙여넣기·탭 행·routeText 세그먼트가 지명이 아닌 UI/행정/항공 문구인지 */
export function isRegisterScheduleRoutePlaceNoise(label: string): boolean {
  const t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length > 96) return true
  if (t.length < 2 && !/^[\uAC00-\uD7AF]{1,2}$/u.test(t)) return true
  if (isRegisterScheduleAirlineRouteSegment(t)) return true
  if (ROUTE_PLACE_NOISE_START_RE.test(t)) return true
  if (ROUTE_ADMIN_GUIDANCE_RE.test(t)) return true
  if (/^몽골\s*FAQ$/iu.test(t)) return true
  if (/필수\s*코스|쇼핑\s*타임|시내를\s*떠나기\s*전/u.test(t)) return true
  if (/면세(?:점|품)?(?:\s*\d+)?\s*(?:회\s*)?쇼핑|쇼핑\s*\d+\s*회/u.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: outlet·영화제목 쇼핑/옵션 노이즈 — manifest
  if (/\b(?:designer\s*)?outlet\b|아울렛|아웃렛|pandorf|파르도르프/i.test(t)) return true
  if (/sound\s*of\s*music|사운드\s*오브\s*뮤직|사운드오브뮤직/i.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 독일·유럽 admin·교통 세그먼트 — manifest
  if (/^(?:필독\s*사항|유의\s*사항|안내\s*사항)$/u.test(t)) return true
  if (/^(?:내부\s*(?:입장|관람)?|외관|입장|정원\s*입장|조망)$/u.test(t)) return true
  if (/사진\s*촬영\s*(?:후\s*)?이동/u.test(t)) return true
  if (/^AFTERNOON\s*TEA$/i.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 터키 체험·이동 꼬리 노이즈 — manifest
  if (/밸리\s*댄스|벨리\s*댄스/u.test(t)) return true
  if (/^지프\s*차$|^지프차$|^파묵칼레\s*카트$/u.test(t)) return true
  if (/^카라반들의\s*숙소$/u.test(t)) return true
  if (/롯데관광\s*유일/u.test(t)) return true
  // 일정 산문 덤프(돌로미티 「낭만과 비극을…」) — 지명 세그먼트 아님
  if (
    t.length >= 18 &&
    /[가-힣]{6,}/u.test(t) &&
    /(?:의|을|를|으로|에서|함께|가장|상징|양식|거대한)/u.test(t)
  ) {
    return true
  }
  if (/^(?:ICE|IC|TGV|KTX)$/i.test(t)) return true
  // 숙박 거점 온천마을 — 관광 명소 키워드 우선 시 세그먼트 노이즈
  if (/^몬테카티니(?:테르메)?$/u.test(t)) return true
  if (/^MONTECATINI(?:\s*TERME)?$/i.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 호텔명·교외토큰·단독 국가명 — manifest
  if (/^(?:HOTEL|Hotel)\b/.test(t)) return true
  if (
    isHotelLodgingImageKeyword(t) &&
    !/(?:성|궁|탑|사원|박물관|유적|폭포|대성당|등\s*\d+\s*성|\/\s*(?:준)?\d+\s*성)/u.test(t)
  ) {
    return true
  }
  if (/^(?:VELIZY|MEUDON)$/i.test(t) && t.length <= 12) return true
  if (
    /^(?:프랑스|이탈리아|독일|스페인|포르투갈|스위스|영국|오스트리아|체코|헝가리|벨기에|네덜란드|튀르키예|터키)$/u.test(
      t,
    )
  ) {
    return true
  }
  if (/^(?:뷰\s*)?레스토랑$/u.test(t)) return true
  if (/\bFAQ\b/i.test(t) && t.length <= 24) return true
  if (/\b안내\b/u.test(t) && /(?:입국|출국|출입국|비자|세관|여행)/u.test(t)) return true
  if (/^(?:조식|중식|석식|기내|기장|승무원)/i.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: price·meal·marketing — manifest
  if (ROUTE_PRICE_MEAL_MARKETING_NOISE_RE.test(t)) return true
  if (/미식|먹거리\s*볼거리/u.test(t) && !ROUTE_POI_TAIL_HINT_RE.test(t)) return true
  if (/^\d+일차$/u.test(t)) return true
  if (/^(?:뉴질랜드|호주|일본|중국|태국|베트남)\s*.+(?:관광|투어)$/u.test(t)) return true
  if (/하이라이트\s*_/u.test(t)) return true
  if (/^(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ)(?:\s*국제)?\s*공항?$/i.test(t)) return true
  if (/^.{1,28}국제공항$/u.test(t) && !/(?:박물관|역사|항공\s*박물관)/u.test(t)) return true
  if (/^.{2,8}성$/u.test(t) && /(?:산동|강소|요녕|하북|하남|광동|절강|안후이|길림|사천|운남|신장|티베트|몽골|태국|베트남)/u.test(t)) {
    return true
  }
  if (/선택\s*관광|\$\s*\d|(?:전신)?마사지\s*\(\s*\d+\s*분\s*\)|옵션\s*투어|추천\s*선택/u.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 마사지·쇼핑센터·선착장 이동 문구 — manifest
  if (/(?:전신|발)?\s*마사지(?:\s*\d+\s*(?:분|시간))?$/u.test(t)) return true
  if (/^쇼핑\s*센터$|^쇼핑몰$|^스트릿\s*카$/u.test(t)) return true
  if (
    /하루\s*동안\s*여러\s*장면|알찬\s*동선|전체적인\s*흐름과\s*분위기|여행의\s*컨셉|귀국길로\s*이어지|이동\s*중심의\s*마무리|현지\s*도착\s*후\s*첫날|보기와\s*걷기가\s*균형|보기와\s*이동이\s*균형/i.test(
      t,
    )
  ) {
    return true
  }
  if (/이미지$/u.test(t) && !/(?:궁|성|사원|박물관|수도원|종탑|대성당)/u.test(t)) return true
  if (/^(?:모든\s*지역|엄선된)/u.test(t)) return true
  if (/호텔\s*(?:체크\s*아웃|개별\s*조식)|체크\s*아웃\s*후/u.test(t)) return true
  if (/날짜\s*변경선|타사\s*비교|비즈니스\s*석|프라이빗\s*전용|여행\s*준비\s*가이드|골든패스|국경\s*통과/u.test(t)) return true
  // 단독 `가이드 미팅`만 noise — `가이드 미팅 후 호이안…` 는 꼬리 추출 대상
  if (/^가이드\s*미팅(?:\s*후)?$/u.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 공항 피켓·가이드 복장·미팅 데스크 — manifest
  if (/피켓\s*앞|녹색\s*셔츠|가이드\s*:\s*|미팅\s*데스크|입국장\s*나와서/u.test(t)) return true
  if (/국제공항.+(?:피켓|가이드|터미널)/u.test(t) && t.length <= 48) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 료칸·온천욕·관광면세점 route 금지 — manifest
  if (/(?:관광)?면세점|천연\s*온천욕|온천욕$/u.test(t)) return true
  if (/^우메코지\s*카덴쇼(?:\s*료칸)?$/u.test(t)) return true
  if (/^교토\s*우메코지/u.test(t)) return true
  if (/료칸|카덴쇼/u.test(t) && /(?:온천|욕|숙박|료칸)/u.test(t)) return true
  if (/고베\s*(?:국제)?공항|Kobe\s*(?:International\s*)?Airport/i.test(t)) return true
  if (/^호텔(?:\s*이동|\s*조식|\s*투숙)?$/u.test(t)) return true
  if (/^공항(?:\s*도착|\s*출발|\s*경유)?$/u.test(t) && t.length <= 12) return true
  if (/숙박\s*없음|입국\s*절차|파타야\s*대표\s*쇼|콜로세움.*쇼|콜롯세움|북경\s*서커스|베이징\s*서커스/u.test(t)) {
    return true
  }
  if (/블루스타|Blue\s*Star\s*Delos|수완나(?:품|폼)|B게이트|출입구/u.test(t)) return true
  // REGRESSION-FREEZE[schedule-image-keyword-return-gate-block]: 탑승·출국 게이트 route noise — manifest
  if (/^(?:탑승|출국|입국|도착|출발)?\s*게이트$/u.test(t)) return true
  if (/^(?:boarding|departure|arrival|airport)\s+gates?$/iu.test(t)) return true
  if (/^gates?$/iu.test(t)) return true
  if (/자유일정\s*추천|전통\s*마사지|빅\s*씨|Big\s*C/u.test(t) && t.length <= 48) return true
  if (/^Travel\s*Tip$/i.test(t)) return true
  if (/^유락죠\s*온천/i.test(t)) return true
  if (/정규\s*\d+\s*성\s*급\s*호텔|성\s*급\s*호텔/u.test(t)) return true
  // 비행·소요·고아 괄호 조각
  if (/^[\[\]]+$/u.test(t)) return true
  if (/소요\]?$/u.test(t) && /(?:시간|약\s*\d)/u.test(t)) return true
  if (/공항\s*출발\s*\([A-Z]{2}\d/i.test(t)) return true
  if (/^이동\s*후\s*호텔\s*투숙/u.test(t)) return true
  if (/나이트\s*워킹|인솔자\s*미동행|\*자유시간/u.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 북경 교원 — VIP리무진·인력거·쇼·도시락 route 금지 — manifest
  if (/VIP\s*리무진|리무진\s*버스|(?:^|[\s\-])리무진(?:$|[\s\-])/u.test(t) && t.length <= 28) {
    return true
  }
  if (/^인력거$|인력거\s*(?:체험|투어)?$/u.test(t)) return true
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: India AWP902 — 릭샤·이른기상·도시락 route 금지 — manifest
  if (/^(?:릭샤|리크샤|rickshaw)$/iu.test(t)) return true
  if (/(?:릭샤|리크샤|rickshaw)/iu.test(t) && t.length <= 28) return true
  if (/도시락(?:\s*식사)?(?:\s*후)?$/u.test(t)) return true
  if (/도시락\s*지참|이른\s*기상(?:\s*후)?/u.test(t) && t.length <= 48) return true
  if (/이른\s*기상.{0,24}(?:도시락|공항)|도시락.{0,16}공항/u.test(t) && t.length <= 56) {
    return true
  }
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 특식·기차역·공항 route noise — manifest
  if (/^특식\s*[:：]/u.test(t) || /^특식\s*:/u.test(t)) return true
  if (/특식\s*[:：].{0,24}/u.test(t) && t.length <= 40) return true
  if (/^(?:기차역|공항)$/u.test(t)) return true
  if (/(?:타슈켄트|비슈케크|알마티)?\s*공항$/u.test(t) && t.length <= 16) return true
  if (/관광\s*후\s*.{0,12}기차역/u.test(t) && t.length <= 36) return true
  if (/소림(?:무술)?쇼|경극|(?:쇼|경극)\s*또는\s*(?:쇼|경극)/u.test(t) && t.length <= 48) {
    return true
  }
  if (/^전문\s*대가$|^전문대가$/u.test(t)) return true
  return false
}

/** 하나투어 등 API placeholder — 명소 없는 관광 filler routeText */
export function isRegisterScheduleGenericTourismFillerRouteText(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  return /하루\s*동안\s*여러\s*장면|알찬\s*동선|전체적인\s*흐름과\s*분위기|여행의\s*컨셉/i.test(t)
}

/** 한·영 도시 표기 중복(비엔나↔Vienna) — 짧은 도시 라벨만 */
const ROUTE_CITY_ALIAS_KEY_RULES: ReadonlyArray<{ re: RegExp; key: string }> = [
  { re: /^(?:프라하|prague|praha)$/i, key: 'prague' },
  { re: /^(?:비엔나|vienna|wien)$/i, key: 'vienna' },
  { re: /^(?:부다페스트|budapest)$/i, key: 'budapest' },
  { re: /^(?:린츠|linz)$/i, key: 'linz' },
  { re: /^(?:브라티슬라바|bratislava)$/i, key: 'bratislava' },
  { re: /^(?:브르노|brno)$/i, key: 'brno' },
  { re: /^(?:잘츠부르크|잘쯔부르크|salzburg)$/i, key: 'salzburg' },
  { re: /^(?:할슈타트|hallstatt)$/i, key: 'hallstatt' },
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 독일 한·영 도시 중복 — manifest
  { re: /^(?:프랑크푸르트|frankfurt)$/i, key: 'frankfurt' },
  { re: /^(?:뮌헨|munich|m[uü]nchen)$/i, key: 'munich' },
  { re: /^(?:베를린|berlin)$/i, key: 'berlin' },
  { re: /^(?:드레스덴|dresden)$/i, key: 'dresden' },
  { re: /^(?:뉘른베르크|nuremberg|n[uü]rnberg)$/i, key: 'nuremberg' },
  { re: /^(?:캠프텐|켐프텐|kempten)$/i, key: 'kempten' },
  { re: /^(?:퓌센|f[uü]ssen|fussen)$/i, key: 'fussen' },
  { re: /^(?:킴제|chiemsee)$/i, key: 'chiemsee' },
  { re: /^(?:밤베르크|bamberg)$/i, key: 'bamberg' },
  { re: /^(?:포츠담|potsdam)$/i, key: 'potsdam' },
  { re: /^(?:로텐부르크|rothenburg)$/i, key: 'rothenburg' },
  { re: /^(?:뤼데스하임|r[uü]desheim|rudesheim)$/i, key: 'rudesheim' },
  { re: /^(?:벨파스트|belfast)$/i, key: 'belfast' },
  { re: /^(?:더블린|dublin)$/i, key: 'dublin' },
  { re: /^(?:에딘버러|edinburgh)$/i, key: 'edinburgh' },
  { re: /^(?:런던|london)$/i, key: 'london' },
  { re: /^(?:파리|paris)$/i, key: 'paris' },
  { re: /^(?:니스|nice)$/i, key: 'nice' },
  { re: /^(?:보르도|bordeaux)$/i, key: 'bordeaux' },
  { re: /^(?:아비뇽|avignon)$/i, key: 'avignon' },
  { re: /^(?:시드니|sydney)$/i, key: 'sydney' },
  { re: /^(?:오클랜드|auckland)$/i, key: 'auckland' },
]

function registerScheduleRouteCityAliasKey(label: string): string | null {
  const t = String(label ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length > 24) return null
  if (/(?:성|궁|교|광장|요새|다리|castle|palace|bridge|square|fortress)/i.test(t)) return null
  for (const { re, key } of ROUTE_CITY_ALIAS_KEY_RULES) {
    if (re.test(t)) return key
  }
  return null
}

function preferRegisterScheduleRouteCityLabel(label: string): string {
  return String(label ?? '')
    .replace(/\s*\([A-Za-zÀ-ÿ][^)]{0,40}\)\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim() || String(label ?? '').trim()
}

/** routeText·places 배열에서 행정/UI·국내 출발 허브 세그먼트 제거 */
export function filterRegisterScheduleRoutePlaceSegments(segments: readonly string[]): string[] {
  const out: string[] = []
  const keys: string[] = []
  const cityAliasKeys: Array<string | null> = []
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/[^a-z0-9가-힣]/g, '')
  for (const raw of segments) {
    for (const label of expandRegisterScheduleRoutePlaceCandidates(String(raw ?? ''))) {
      if (!label || isRegisterScheduleRoutePlaceNoise(label)) continue
      if (isRegisterScheduleDomesticHubRouteSegment(label)) continue
      const display = preferRegisterScheduleRouteCityLabel(label)
      const key = norm(display)
      if (!key) continue
      const dupIdx = keys.findIndex(
        (k) => k === key || (k.length >= 4 && key.includes(k)) || (key.length >= 4 && k.includes(key)),
      )
      if (dupIdx >= 0) {
        if (display.length > out[dupIdx]!.length) out[dupIdx] = display
        continue
      }
      // REGRESSION-FREEZE[register-schedule-route-place-noise]: 비엔나↔Vienna 한·영 도시 중복 제거 — manifest
      const cityAlias = registerScheduleRouteCityAliasKey(display)
      if (cityAlias) {
        const cityDup = cityAliasKeys.findIndex((c) => c === cityAlias)
        if (cityDup >= 0) {
          const preferKo = /[가-힣]/.test(display) && !/[가-힣]/.test(out[cityDup] ?? '')
          if (preferKo) {
            out[cityDup] = display
            keys[cityDup] = key
          }
          continue
        }
      }
      cityAliasKeys.push(cityAlias)
      keys.push(key)
      out.push(display)
    }
  }
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 독일 숙박거점 캠프텐 북부 bleed 금지 — manifest
  // 베를린·드레스덴 일차에 바이에른 숙박거점(캠프텐)이 붙는 일정 스크래퍼 bleed
  const hasNorthDe = out.some((s) =>
    /^(?:베를린|berlin|포츠담|potsdam|드레스덴|dresden)$/i.test(s.trim()),
  )
  if (hasNorthDe) {
    return out.filter((s) => !/^(?:캠프텐|켐프텐|kempten)$/i.test(s.trim()))
  }
  return out
}

/**
 * 해밀턴 가든 등 — 「중국, 영국, 일본, 미국, 인도, 이탈리아의 전형적인 정원」국가나열은 방문국이 아님.
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: theme-garden country list strip — manifest
 */
const ROUTE_THEME_GARDEN_COUNTRY_LIST_RE =
  /(?:중국|영국|일본|미국|인도|이탈리아|china|britain|\buk\b|japan|usa|america|india|italy)(?:\s*[,，·\/]\s*(?:중국|영국|일본|미국|인도|이탈리아|china|britain|\buk\b|japan|usa|america|india|italy)){2,}[^\n-]{0,64}?(?:전형적(?:인)?\s*)?(?:정원|garden|허브\s*정원)/giu

export function stripRegisterScheduleRouteThemeGardenCountryList(routeText: string): string {
  return String(routeText ?? '')
    .replace(ROUTE_THEME_GARDEN_COUNTRY_LIST_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** 기존 routeText 문자열 — 세그먼트 분리 후 noise 제거·재조립 */
export function sanitizeRegisterScheduleRouteText(
  routeText: string | null | undefined,
  maxPlaces = 7,
): string | null {
  // REGRESSION-FREEZE[register-schedule-route-place-noise]: theme-garden country list strip — manifest
  const raw = String(routeText ?? '').trim()
  // REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 리조트 자유일 empty route ← title — manifest
  // 리조트·자유시간 라벨은 place 체인이 아니어도 유지 (sanitize가 null로 비우면 live gate hard fail)
  if (
    /자유\s*시간|리조트\s*(?:내\s*)?부대|전일\s*리조트|호텔\s*(?:내\s*)?자유|체크\s*아웃|레이트\s*체크/i.test(
      raw,
    )
  ) {
    return raw.slice(0, Math.max(40, maxPlaces * 24))
  }
  const stripped = stripRegisterScheduleRouteFlightDurationBlocks(
    stripRegisterScheduleRouteThemeGardenCountryList(raw),
  )
  if (!stripped) return null
  // routeText 체인은 ` - ` 구분 — 세그먼트 안 쉼표 지명(예: 대,소석림)은 유지
  const segments = /\s+-\s+/u.test(stripped)
    ? stripped.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean)
    : splitRouteTextPlaceSegments(stripped)
  const chain = filterRegisterScheduleRoutePlaceSegments(segments).slice(0, maxPlaces)
  return chain.length > 0 ? chain.join(' - ') : null
}
