/**
 * 등록 schedule imageKeyword — 대륙·목적지 불일치 랜드마크 환각 차단 (6공급사 공용).
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: inferRegisterEffectiveProductDestination — manifest
 * REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 유럽 목적지 아시아 키워드 차단 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: 산토리니·두바이·KL·식사 dest — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-identity-country-landmark]: 같은 날 나라 혼선·AU/NZ — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: 하와이≠푸켓 · 중남미≠니스 — manifest
 */
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|오키나와|Okinawa|미야코|Miyako|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|방콕|Bangkok|파타야|Pattaya|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|장가계|Zhangjiajie|내몽골|Inner\s*Mongolia|후룬베이얼|Hulunbuir|만주리|Manzhouli|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii|다낭|Da\s*Nang|오사카|Osaka|도쿄|Tokyo|상해|Shanghai|북경|Beijing|코타키나발루|Kota\s*Kinabalu|보르네오|Borneo|조이\s*아일랜드|Joy\s*Island/i

/** 호주·뉴질랜드 — ASIA_PACIFIC에 안 묶여도 Mount Fuji 등 환각 차단용 */
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Oceania dest Japan/Europe hallucination — manifest
export const OCEANIA_PRODUCT_DEST_RE =
  /호주|Australia|뉴질랜드|New\s*Zealand|오세아니아|Oceania|시드니|Sydney|멜버른|Melbourne|브리즈번|Brisbane|퍼스|Perth|오클랜드|Auckland|크라이스트|Christchurch|퀸즈?\s*타운|Queenstown|로토루아|Rotorua/i

// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 조이아일랜드·아일랜드호핑 ≠ EU Ireland — manifest
// bare 「아일랜드」는 섬/Joy Island/호핑 오탐 — Ireland·아일랜드 공화국·일주만 Europe
export const EUROPE_PRODUCT_DEST_RE =
  /유럽|Europe|서유럽|동유럽|북유럽|남유럽|중동유럽|발트|Baltic|스칸디|Scandinav|지중해|Mediterranean|프랑스|France|이탈리아|Italy|스페인|Spain|독일|Germany|스위스|Switzerland|영국|Britain|UK|Ireland|(?<![가-힣])아일랜드(?:\s*(?:공화국|일주|완전일주|패키지|여행|더블린|Dublin)|(?=\s*[<(#]))|그리스|Greece|터키|Turkey|크로아티아|Croatia|체코|Czech|Austria|오스트리아|헝가리|Hungary|폴란드|Poland|네덜란드|Netherlands|벨기에|Belgium|포르투갈|Portugal|노르웨이|Norway|스웨덴|Sweden|핀란드|Finland|덴마크|Denmark|아이슬란드|Iceland|리투아니아|Lithuania|에스토니아|Estonia|라트비아|Latvia|빌니우스|Vilnius|탈린|Tallinn|(?<![가-힣])리가(?![가-힣])|\bRiga\b|프라하|Prague|파리|Paris|로마|Rome|런던|London|바르셀로나|Barcelona|보르도|Bordeaux|인터라켄|Interlaken|융프라우|Jungfrau|피렌체|Florence|베네치아|Venice|취리히|Zurich|암스테르담|Amsterdam|비엔나|Vienna|부다페스트|Budapest|바르샤바|Warsaw|헬싱키|Helsinki|스톡홀름|Stockholm|코펜하겐|Copenhagen|Oslo|오슬로|Reykjavik|베르겐|Bergen|플롬|Flam|Flåm|미주리나|Misurina|돌로미테|Dolomit|몬세라트|Montserrat|콜로세움|Colosseum|에펠|Eiffel/i

export const AMERICAS_PRODUCT_DEST_RE =
  /미국|USA|U\.S\.|(?<![가-힣])미주(?![가-힣])|미서부|미동부|미남부|미국서부|미국동부|Canada|캐나다|멕시코|Mexico|브라질|Brazil|아르헨|Argentina|칠레|Chile|페루|Peru|Colombia|콜롬비아|남미|북미|중남미|South\s*America|North\s*America|Latin\s*America|알래스카|Alaska|앵커리지|Anchorage|주노|Juneau|스캐그웨이|Skagway|케치칸|Ketchikan|글래시어\s*베이|Glacier\s*Bay|하와이|Hawaii|괌|Guam|사이판|Saipan|Los\s*Angeles|\bLA\b|뉴욕|New\s*York|샌프란|San\s*Francisco|라스베가스|Las\s*Vegas|시애틀|Seattle|밴쿠버|Vancouver|토론토|Toronto|리마|Lima|마나우스|Manaus|리우\s*데|리오\s*데|Rio\s*de\s*Janeiro|Mexico\s*City|과달라하라|Guadalajara|Americas/i
// REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: bare 리우/Rio 제거 — manifest
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 알래스카·미주 dest — Space Needle 오탐 금지 — manifest
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 미주리나≠미주 Americas — manifest
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: MILANO≠LA Americas — manifest

export const MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE =
  /중동|Middle\s*East|두바이|Dubai|아부다비|Abu\s*Dhabi|이집트|Egypt|카이로|Cairo|룩소르|Luxor|모로코|Morocco|케냐|Kenya|남아|South\s*Africa|아프리카|Africa|탄자니아|Tanzania|에티오피아|Ethiopia|요르단|Jordan|이스라엘|Israel|카타르|Qatar|오만|Oman|튀니지|Tunisia|나미비아|Namibia|보츠와나|Botswana|Zimbabwe|잠비아|Zambia|우간다|Uganda|르완다|Rwanda|Senegal|세네갈|가나|Ghana|나이지리아|Nigeria|UAE|아랍에미리트/i

const GENERIC_PRODUCT_DEST_RE = /^(?:미지정|미정|기타|해외|overseas|unknown)$/i

/** 식사·항공권·객실·비자 — 대륙 dest hay에 쓰지 않는다. */
const NON_PLACE_PRODUCT_DEST_RE =
  /석식|중식|조식|현지식|항공권|왕복항공|왕복\s*항공|객실|호텔\s*객실|료칸\s*객실|전자비자|\bESTA\b|유류세|미입력|여행일정|중국식|프리미|원하는|슈페리어룸|트윈룸/i

export function isRegisterPrePhotoPlaceLikeDestination(raw: string | null | undefined): boolean {
  const dest = String(raw ?? '').trim()
  if (!dest) return false
  if (GENERIC_PRODUCT_DEST_RE.test(dest)) return false
  if (NON_PLACE_PRODUCT_DEST_RE.test(dest)) return false
  return true
}

/** 검증·힐 dest hay — 제목 + 장소처럼 보이는 destination. countryKey 금지. */
export function registerPrePhotoPlaceDestHay(
  productDestination?: string | null,
  productTitle?: string | null,
): string {
  const title = String(productTitle ?? '').trim()
  const dest = String(productDestination ?? '').trim()
  const place = isRegisterPrePhotoPlaceLikeDestination(dest) ? dest : ''
  return `${title} ${place}`.trim()
}

const CROSS_CONTINENT_HALLUCINATION_KW_RES: ReadonlyArray<RegExp> = [
  /\bParis\b/i,
  /\bEiffel\b/i,
  // Louvre Museum(파리)만 — Louvre Abu Dhabi는 중동 실사
  /\bLouvre\b(?!\s*Abu)/i,
  /Notre\s*Dame/i,
  /\bColosseum\b/i,
  /\bRome\b/i,
  /Big\s*Ben/i,
  /London\s*Eye/i,
  /Tower\s*of\s*London/i,
  /\bBarcelona\b/i,
  /Sagrada\s*Familia/i,
  /\bAmsterdam\b/i,
  /\bVenice\b/i,
  /Brandenburg/i,
  /\bMunich\b/i,
  /Arc\s*de\s*Triomphe/i,
  /Versailles/i,
  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Istanbul — 아시아(내몽골) 환각 차단 — manifest
  /\bIstanbul\b/i,
  /Hagia\s*Sophia/i,
  /Topkapi/i,
  /Bosphorus/i,
  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Provence — 일본(홋카이도) 환각 차단 — manifest
  /\bProvence\b/i,
  /\bValensole\b/i,
  /Aix-en-Provence/i,
  // REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: 아시아 dest 산토리니 금지 — manifest
  /\bSantorini\b/i,
  /\bFira\b/i,
  /\bOia\b/i,
  /Caldera\s*Blue\s*Domes/i,
  /\bNice\b/i,
  /Place\s*Massena/i,
]

const JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE =
  /\b(Osaka(?:\s*Castle)?|Tokyo(?:\s*Disneyland)?|Kyoto|Dotonbori|Shibuya|Harajuku|Fushimi|Kinkakuji|Ginkakuji|Mount\s*Fuji|Fuji|Nara|Universal\s*Studios\s*Japan)\b/i

const ASIA_PACIFIC_HALLUCINATION_ON_NON_ASIA_DEST_RE =
  /\b(Phuket|Pattaya|Bangkok|Bali|Hoi\s*An|Da\s*Nang|Chiang\s*Mai|Singapore|Maldives|Nha\s*Trang)\b/i

const AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE =
  /\b(Christ\s*the\s*Redeemer|Griffith\s*Observatory|Golden\s*Gate|Statue\s*of\s*Liberty|Times\s*Square|Grand\s*Canyon|Niagara\s*Falls|Glacier\s*Bay|Alaska|Space\s*Needle|Pike\s*Place)\b/i

// REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: Kuala Lumpur 귀국 경유 금지 — manifest
const KL_MALAYSIA_DEST_RE = /말레이|Malaysia|쿠알라|Kuala\s*Lumpur|\bKL\b|페트로나스|Petronas|코타키나발루|Kota\s*Kinabalu/i
const KL_HUB_KW_RE = /Kuala\s*Lumpur|Petronas|쿠알라룸푸르/i
const DUBAI_KW_RE = /\bDubai\b|Burj\s*Khalifa|두바이/i
const EGYPT_DEST_RE = /이집트|Egypt|카이로|Cairo|룩소르|Luxor|아스완|Aswan|기자|Giza|후르가다|Hurghada/i
const DUBAI_VISIT_RE = /두바이|Dubai|아부다비|Abu\s*Dhabi|부르즈|Burj/i

function destHayIsMalaysiaOrKl(dest: string): boolean {
  return KL_MALAYSIA_DEST_RE.test(dest)
}

function destHayIsEgypt(dest: string): boolean {
  return EGYPT_DEST_RE.test(dest)
}

function scheduleTripHay(scheduleRows?: readonly RegisterScheduleTripDestinationRow[]): string {
  return (scheduleRows ?? [])
    .flatMap((r) => [r.routeText, r.title, r.description])
    .filter(Boolean)
    .join('\n')
}

function isOffTripKualaLumpurKeyword(dest: string, haystacks: readonly string[]): boolean {
  if (destHayIsMalaysiaOrKl(dest)) return false
  return haystacks.some((h) => KL_HUB_KW_RE.test(h))
}

const AU_ONLY_DEST_RE =
  /시드니|Sydney|멜버른|Melbourne|브리즈번|Brisbane|골드\s*코스트|Gold\s*Coast|퍼스|Perth|호주|Australia|케언즈|Cairns/i
const NZ_ONLY_DEST_RE =
  /뉴질랜드|New\s*Zealand|오클랜드|Auckland|퀸즈?\s*타운|Queenstown|크라이스트|Christchurch|로토루아|Rotorua/i
const NZ_OFF_TRIP_KW_RE =
  /Christchurch|Auckland|Queenstown|Rotorua|Milford|Hobbiton|Wellington|Tekapo|Hagley\s*Park/i
const AU_OFF_TRIP_KW_RE =
  /Sydney\s*Opera|Bondi|Gold\s*Coast|Surfers\s*Paradise|Uluru|Blue\s*Mountains|Melbourne|Taronga/i

function isOffTripAustraliaNewZealandKeyword(dest: string, haystacks: readonly string[]): boolean {
  const auOnly = AU_ONLY_DEST_RE.test(dest) && !NZ_ONLY_DEST_RE.test(dest)
  const nzOnly = NZ_ONLY_DEST_RE.test(dest) && !AU_ONLY_DEST_RE.test(dest)
  if (auOnly && haystacks.some((h) => NZ_OFF_TRIP_KW_RE.test(h))) return true
  if (nzOnly && haystacks.some((h) => AU_OFF_TRIP_KW_RE.test(h))) return true
  return false
}

const KEYWORD_COUNTRY_FAMILY: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'italy', re: /Colosseum|Rome|Venice|Vatican|Florence|Milan|Pantheon|Trevi|Doge|Rialto|Uffizi|Duomo|Spanish\s*Steps/i },
  { id: 'switzerland', re: /Jungfrau|Interlaken|Matterhorn|Lucerne|Zermatt|Chapel\s*Bridge|Rigi|Chillon|Titlis|Kapell/i },
  { id: 'france', re: /Louvre|Eiffel|Versailles|Paris|Sacr[eé]|Orsay|Montmartre/i },
  { id: 'spain', re: /Sagrada|Park\s*Guell|Alhambra|Seville|Barcelona|Prado|Toledo|Montserrat/i },
  { id: 'uk', re: /Big\s*Ben|Tower\s*Bridge|Westminster|Buckingham|London|Piccadilly/i },
  { id: 'nz', re: /Christchurch|Auckland|Queenstown|Rotorua|Milford|Hobbiton|Wellington|Tekapo/i },
  { id: 'au', re: /Sydney|Bondi|Gold\s*Coast|Surfers|Uluru|Blue\s*Mountains|Melbourne|Taronga/i },
]

function keywordCountryFamilyId(keyword: string): string | null {
  const t = String(keyword ?? '').trim()
  if (!t) return null
  for (const f of KEYWORD_COUNTRY_FAMILY) {
    if (f.re.test(t)) return f.id
  }
  return null
}

/** 같은 날 1·2순위 키워드가 서로 다른 나라면 파서 혼선 */
export function isRegisterScheduleSameDayKeywordCountryClash(
  keyword: string | null | undefined,
  keyword2: string | null | undefined,
): boolean {
  const a = keywordCountryFamilyId(String(keyword ?? ''))
  const b = keywordCountryFamilyId(String(keyword2 ?? ''))
  return Boolean(a && b && a !== b)
}

export type RegisterScheduleTripDestinationRow = {
  routeText?: string | null
  title?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function inferContinentLabelFromHaystack(hay: string): string {
  // imageKeyword는 추론에 쓰지 않음 — "Europe" 등 오염 키워드가 dest를 뒤집음
  // Europe를 Americas보다 우선 — MILANO·미주리나 잔여 오탐보다 이탈리아·서유럽 실방문 우선
  if (EUROPE_PRODUCT_DEST_RE.test(hay)) return 'Europe'
  if (AMERICAS_PRODUCT_DEST_RE.test(hay)) return 'Americas'
  if (ASIA_PACIFIC_PRODUCT_DEST_RE.test(hay)) return 'Asia Pacific'
  if (OCEANIA_PRODUCT_DEST_RE.test(hay)) return 'Oceania'
  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(hay)) return 'Africa'
  return ''
}

/** primaryDestination 미지정 — 일정 routeText·키워드에서 목적지 대륙 힌트 SSOT */
export function inferRegisterEffectiveProductDestination(
  productDestination: string | null | undefined,
  rows: readonly RegisterScheduleTripDestinationRow[],
): string {
  const dest = String(productDestination ?? '').trim()
  const hay = rows
    .flatMap((r) => [r.routeText, r.title, r.description])
    .filter(Boolean)
    .join('\n')
  const fromHay = inferContinentLabelFromHaystack(hay)
  if (dest && !GENERIC_PRODUCT_DEST_RE.test(dest)) {
    // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 알래스카·미주 dest — Space Needle 오탐 금지 — manifest
    // primaryDestination이 아시아 등으로 잘못 와도, 일정 hay가 미주·알래스카만이면 schedule 우선
    const destAsiaOnly =
      ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest) &&
      !AMERICAS_PRODUCT_DEST_RE.test(dest) &&
      !EUROPE_PRODUCT_DEST_RE.test(dest)
    const hayAmericasOnly =
      fromHay === 'Americas' &&
      !EUROPE_PRODUCT_DEST_RE.test(hay) &&
      !ASIA_PACIFIC_PRODUCT_DEST_RE.test(hay)
    if (destAsiaOnly && hayAmericasOnly) return 'Americas'
    const destEuropeish = EUROPE_PRODUCT_DEST_RE.test(dest)
    const hayEuropeOnly =
      fromHay === 'Europe' &&
      !AMERICAS_PRODUCT_DEST_RE.test(hay) &&
      !ASIA_PACIFIC_PRODUCT_DEST_RE.test(hay)
    if (
      ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest) &&
      !destEuropeish &&
      !AMERICAS_PRODUCT_DEST_RE.test(dest) &&
      hayEuropeOnly
    ) {
      return 'Europe'
    }
    return dest
  }
  return fromHay || dest
}

// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Americas block Universal Studios Japan — manifest
export function isRegisterScheduleCrossContinentHallucinationKeyword(
  keyword: string | null | undefined,
  productDestination: string | null | undefined,
  scheduleRows?: readonly RegisterScheduleTripDestinationRow[],
): boolean {
  const dest = inferRegisterEffectiveProductDestination(
    productDestination,
    scheduleRows ?? [],
  )
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  const fin = normalizeToPlaceName(raw)
  const haystacks = fin && fin !== raw ? [raw, fin] : [raw]
  if (isOffTripKualaLumpurKeyword(dest, haystacks)) return true
  if (isOffTripAustraliaNewZealandKeyword(dest, haystacks)) return true

  if (EUROPE_PRODUCT_DEST_RE.test(dest) && !ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest) && !OCEANIA_PRODUCT_DEST_RE.test(dest)) {
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    if (haystacks.some((h) => AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE.test(h))) return true
    if (haystacks.some((h) => ASIA_PACIFIC_HALLUCINATION_ON_NON_ASIA_DEST_RE.test(h))) return true
    if (/\bGiza\b/i.test(raw) || /\bPhuket\b/i.test(raw)) return true
    // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 유럽에 Louvre Abu Dhabi 금지 — manifest
    // 단, 일정에 아부다비·두바이 실방문이 있으면 다도시 상품으로 허용
    const tripHay = (scheduleRows ?? [])
      .flatMap((r) => [r.routeText, r.title, r.description])
      .filter(Boolean)
      .join('\n')
    // REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 보르도 카이요 ≠ Cairo — manifest
    if (
      /\bCairo\b/i.test(raw) &&
      !/이집트|Egypt|카이로|\bCairo\b|룩소르|Luxor|기자|Giza/i.test(tripHay)
    ) {
      return true
    }
    const tripHasGulf =
      /아부다비|Abu\s*Dhabi|두바이|Dubai|사디야트|Saadiyat/i.test(tripHay)
    if (
      !tripHasGulf &&
      /Louvre\s*Abu\s*Dhabi|Abu\s*Dhabi|Saadiyat|Dubai|Burj\s*Khalifa|Sheikh\s*Zayed/i.test(raw)
    ) {
      return true
    }
    return false
  }

  if (AMERICAS_PRODUCT_DEST_RE.test(dest)) {
    if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    // 하와이·괌은 ASIA_PACIFIC dest에도 들어가 Phuket이 통과했음. 미주 일정에 동남아 금지.
    if (haystacks.some((h) => ASIA_PACIFIC_HALLUCINATION_ON_NON_ASIA_DEST_RE.test(h))) return true
    return false
  }

  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(dest)) {
    if (
      destHayIsEgypt(dest) &&
      !DUBAI_VISIT_RE.test(scheduleTripHay(scheduleRows)) &&
      haystacks.some((h) => DUBAI_KW_RE.test(h))
    ) {
      return true
    }
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: ME Louvre Abu 실사 — Louvre Museum 축약 허용 — manifest
    const tripHay = (scheduleRows ?? [])
      .flatMap((r) => [r.routeText, r.title, r.description])
      .filter(Boolean)
      .join('\n')
    const tripHasLouvreAbu =
      /루브르\s*아부다비|Louvre\s*Abu|아부다비|Abu\s*Dhabi|사디야트|Saadiyat/i.test(tripHay)
    for (const h of haystacks) {
      for (const re of CROSS_CONTINENT_HALLUCINATION_KW_RES) {
        if (!re.test(h)) continue
        if (/\bLouvre\b/i.test(h) && tripHasLouvreAbu) continue
        return true
      }
    }
    return false
  }

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Oceania dest Japan/Europe hallucination — manifest
  // AU/NZ — Mount Fuji·로마 등 (해밀턴 가든 국가나열·갭필 환각)
  if (OCEANIA_PRODUCT_DEST_RE.test(dest)) {
    const tripHay = (scheduleRows ?? [])
      .flatMap((r) => [r.routeText, r.title, r.description])
      .filter(Boolean)
      .join('\n')
    const tripHasJapanCity =
      /(?:도쿄|Tokyo|오사카|Osaka|교토|Kyoto|하코네|Hakone|후지|Fuji|시즈오카|Shizuoka|나리타|Narita|규슈|Kyushu)/i.test(
        tripHay,
      )
    if (!tripHasJapanCity && haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) {
      return true
    }
    if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
    if (haystacks.some((h) => AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE.test(h))) return true
    if (isOffTripKualaLumpurKeyword(dest, haystacks)) return true
    return false
  }

  if (!ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest)) return false
  if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
  if (haystacks.some((h) => AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE.test(h))) return true
  // REGRESSION-FREEZE[lottetour-singapore-register-quality]: 싱가포르 일정에 USJ 금지 — manifest
  {
    const tripHay = (scheduleRows ?? [])
      .flatMap((r) => [r.routeText, r.title, r.description])
      .filter(Boolean)
      .join('\n')
    const singaporeTrip =
      /싱가포르|Singapore/i.test(dest) || /싱가포르|Singapore/i.test(tripHay)
    const japanTrip =
      /일본|Japan|오사카|Osaka|도쿄|Tokyo|교토|Kyoto/i.test(dest) ||
      /(?:일본|Japan|오사카|Osaka|도쿄|Tokyo|교토|Kyoto)/i.test(tripHay)
    if (
      singaporeTrip &&
      !japanTrip &&
      haystacks.some((h) => /Universal\s*Studios\s*Japan/i.test(h))
    ) {
      return true
    }
    // REGRESSION-FREEZE[lottetour-singapore-register-quality]: 싱가포르에 Flame Towers|Baku 금지 — manifest
    if (
      singaporeTrip &&
      haystacks.some((h) => /Flame\s*Towers|\bBaku\b|Azerbaijan/i.test(h))
    ) {
      return true
    }
    // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 비싱가포르 일정 Merlion 금지 — manifest
    if (
      !singaporeTrip &&
      haystacks.some((h) => /Merlion|Gardens\s*by\s*the\s*Bay|Marina\s*Bay\s*Sands/i.test(h))
    ) {
      return true
    }
  }
  // 푸꾸옥 상품 — 나트랑·발리·앙코르 등 동남아 타목적지 환각 차단
  if (/푸꾸옥|Phu\s*Quoc|푸꾹옥/i.test(dest) || (scheduleRows ?? []).some((r) => /푸꾸옥|Phu\s*Quoc/i.test(String(r.routeText ?? '')))) {
    const tripIsPhuQuocOnly =
      /푸꾸옥|Phu\s*Quoc/i.test(dest) ||
      ((scheduleRows ?? []).some((r) => /푸꾸옥|Phu\s*Quoc/i.test(String(r.routeText ?? ''))) &&
        !(scheduleRows ?? []).some((r) => /나트랑|Nha\s*Trang|발리|Bali|앙코르|Angkor|하롱|Halong/i.test(String(r.routeText ?? ''))))
    if (
      tripIsPhuQuocOnly &&
      /\b(Nha\s*Trang|Po\s*Nagar|Long\s*Son|Bali|Tegalalang|Uluwatu|Angkor|Bayon|Halong|Hoi\s*An|Da\s*Nang)\b/i.test(
        raw,
      )
    ) {
      return true
    }
  }

  // REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: 돗토리·시마네·규슈·간사이 일정 Mount Fuji 환각 — manifest
  if (ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest) || /일본|Japan/i.test(dest)) {
    const tripHay = (scheduleRows ?? [])
      .flatMap((r) => [r.routeText, r.title, r.description])
      .filter(Boolean)
      .join('\n')
    const westOrKyushuTrip =
      /돗토리|Tottori|요나고|Yonago|시마네|Shimane|이즈모|Izumo|마쯔에|Matsue|다마즈쿠리|Tamatsukuri|사카이미나토|Sakaiminato|쿠라요시|Kurayoshi|벳푸|Beppu|유후인|Yufuin|오이타|Oita|후쿠오카|Fukuoka|규슈|Kyushu/i.test(
        tripHay,
      )
    const kansaiTrip =
      /교토|Kyoto|오사카|Osaka|나라|Nara|고베|Kobe|비와|Biwa|아라시야마|Arashiyama|기요미즈|Kiyomizu|도톤보리|Dotonbori/i.test(
        tripHay,
      )
    const fujiCorridor =
      /후지|Fuji|시즈오카|Shizuoka|하코네|Hakone|도쿄|Tokyo|요코하마|Yokohama|나고야|Nagoya|가마쿠라|Kamakura/i.test(
        tripHay,
      )
    if (
      (westOrKyushuTrip || kansaiTrip) &&
      !fujiCorridor &&
      haystacks.some((h) => /\bMount\s*Fuji\b|Fuji\s*Shizuoka|Hakone.*Fuji|Fuji.*view/i.test(h))
    ) {
      return true
    }
  }

  // REGRESSION-FREEZE[register-hk-gogung-not-taipei-npm]: 홍콩·마카오에 대만 국립고궁 금지 — manifest
  {
    const tripHay = `${dest}\n${(scheduleRows ?? [])
      .flatMap((r) => [r.routeText, r.title, r.description])
      .filter(Boolean)
      .join('\n')}`
    const taiwanTrip = /대만|타이완|Taiwan|타이페이|타이베이|Taipei|가오슝/i.test(tripHay)
    const hkMacauTrip = /홍콩|Hong\s*Kong|香港|마카오|Macau|澳門/i.test(tripHay)
    const taiwanOnlyKw =
      /National\s*Palace\s*Museum(?:\s*Taipei)?|Taipei\s*101|Yehliu|Jiufen|Shifen\s*Old\s*Street|Chiang\s*Kai-shek|Sun\s*Moon\s*Lake|Wulai/i
    const hkOnlyKw =
      /Hong\s*Kong\s*Palace\s*Museum|Hong\s*Kong\s*Disneyland|Victoria\s*Peak|Wong\s*Tai\s*Sin|Peak\s*Tram|Avenue\s*of\s*Stars|Tai\s*Kwun/i
    if (hkMacauTrip && !taiwanTrip && haystacks.some((h) => taiwanOnlyKw.test(h))) return true
    if (taiwanTrip && !hkMacauTrip && haystacks.some((h) => hkOnlyKw.test(h))) return true
  }
  if (isOffTripKualaLumpurKeyword(dest, haystacks)) return true
  return false
}
