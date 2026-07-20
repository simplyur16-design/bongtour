/**
 * 등록 schedule imageKeyword — 대륙·목적지 불일치 랜드마크 환각 차단 (6공급사 공용).
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: inferRegisterEffectiveProductDestination — manifest
 * REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 유럽 목적지 아시아 키워드 차단 — manifest
 */
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|오키나와|Okinawa|미야코|Miyako|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|방콕|Bangkok|파타야|Pattaya|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|내몽골|Inner\s*Mongolia|후룬베이얼|Hulunbuir|만주리|Manzhouli|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii|다낭|Da\s*Nang|오사카|Osaka|도쿄|Tokyo|상해|Shanghai|북경|Beijing|코타키나발루|Kota\s*Kinabalu|보르네오|Borneo|조이\s*아일랜드|Joy\s*Island/i

/** 호주·뉴질랜드 — ASIA_PACIFIC에 안 묶여도 Mount Fuji 등 환각 차단용 */
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Oceania dest Japan/Europe hallucination — manifest
export const OCEANIA_PRODUCT_DEST_RE =
  /호주|Australia|뉴질랜드|New\s*Zealand|오세아니아|Oceania|시드니|Sydney|멜버른|Melbourne|브리즈번|Brisbane|퍼스|Perth|오클랜드|Auckland|크라이스트|Christchurch|퀸즈?\s*타운|Queenstown|로토루아|Rotorua/i

// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 조이아일랜드·아일랜드호핑 ≠ EU Ireland — manifest
// bare 「아일랜드」는 섬/Joy Island/호핑 오탐 — Ireland·아일랜드 공화국·일주만 Europe
export const EUROPE_PRODUCT_DEST_RE =
  /유럽|Europe|서유럽|동유럽|북유럽|남유럽|중동유럽|발트|Baltic|스칸디|Scandinav|지중해|Mediterranean|프랑스|France|이탈리아|Italy|스페인|Spain|독일|Germany|스위스|Switzerland|영국|Britain|UK|Ireland|(?<![가-힣])아일랜드(?:\s*(?:공화국|일주|완전일주|패키지|여행|더블린|Dublin)|(?=\s*[<(#]))|그리스|Greece|터키|Turkey|크로아티아|Croatia|체코|Czech|Austria|오스트리아|헝가리|Hungary|폴란드|Poland|네덜란드|Netherlands|벨기에|Belgium|포르투갈|Portugal|노르웨이|Norway|스웨덴|Sweden|핀란드|Finland|덴마크|Denmark|아이슬란드|Iceland|리투아니아|Lithuania|에스토니아|Estonia|라트비아|Latvia|빌니우스|Vilnius|탈린|Tallinn|(?<![가-힣])리가(?![가-힣])|\bRiga\b|프라하|Prague|파리|Paris|로마|Rome|런던|London|바르셀로나|Barcelona|인터라켄|Interlaken|융프라우|Jungfrau|피렌체|Florence|베네치아|Venice|취리히|Zurich|암스테르담|Amsterdam|비엔나|Vienna|부다페스트|Budapest|바르샤바|Warsaw|헬싱키|Helsinki|스톡홀름|Stockholm|코펜하겐|Copenhagen|Oslo|오슬로|Reykjavik|베르겐|Bergen|플롬|Flam|Flåm|미주리나|Misurina|돌로미테|Dolomit|몬세라트|Montserrat|콜로세움|Colosseum|에펠|Eiffel/i

export const AMERICAS_PRODUCT_DEST_RE =
  /미국|USA|U\.S\.|(?<![가-힣])미주(?![가-힣])|미서부|미동부|미남부|미국서부|미국동부|Canada|캐나다|멕시코|Mexico|브라질|Brazil|아르헨|Argentina|칠레|Chile|페루|Peru|Colombia|콜롬비아|남미|북미|중남미|South\s*America|North\s*America|Latin\s*America|알래스카|Alaska|앵커리지|Anchorage|주노|Juneau|스캐그웨이|Skagway|케치칸|Ketchikan|글래시어\s*베이|Glacier\s*Bay|하와이|Hawaii|괌|Guam|사이판|Saipan|Los\s*Angeles|\bLA\b|뉴욕|New\s*York|샌프란|San\s*Francisco|라스베가스|Las\s*Vegas|시애틀|Seattle|밴쿠버|Vancouver|토론토|Toronto|리마|Lima|마나우스|Manaus|리우\s*데|리오\s*데|Rio\s*de\s*Janeiro|Mexico\s*City|과달라하라|Guadalajara|Americas/i
// REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: bare 리우/Rio 제거 — manifest
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 알래스카·미주 dest — Space Needle 오탐 금지 — manifest
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 미주리나≠미주 Americas — manifest
// REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: MILANO≠LA Americas — manifest

export const MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE =
  /중동|Middle\s*East|두바이|Dubai|아부다비|Abu\s*Dhabi|이집트|Egypt|카이로|Cairo|룩소르|Luxor|모로코|Morocco|케냐|Kenya|남아|South\s*Africa|아프리카|Africa|탄자니아|Tanzania|에티오피아|Ethiopia|요르단|Jordan|이스라엘|Israel|카타르|Qatar|오만|Oman|튀니지|Tunisia|나미비아|Namibia|보츠와나|Botswana|Zimbabwe|잠비아|Zambia|우간다|Uganda|르완다|Rwanda|Senegal|세네갈|가나|Ghana|나이지리아|Nigeria|UAE|아랍에미리트/i

const GENERIC_PRODUCT_DEST_RE = /^(?:미지정|미정|기타|해외|overseas|unknown)$/i

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
]

const JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE =
  /\b(Osaka(?:\s*Castle)?|Tokyo(?:\s*Disneyland)?|Kyoto|Dotonbori|Shibuya|Harajuku|Fushimi|Kinkakuji|Ginkakuji|Mount\s*Fuji|Fuji|Nara|Universal\s*Studios\s*Japan)\b/i

const ASIA_PACIFIC_HALLUCINATION_ON_NON_ASIA_DEST_RE =
  /\b(Phuket|Pattaya|Bangkok|Bali|Hoi\s*An|Da\s*Nang|Chiang\s*Mai|Singapore|Maldives|Nha\s*Trang)\b/i

const AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE =
  /\b(Christ\s*the\s*Redeemer|Griffith\s*Observatory|Golden\s*Gate|Statue\s*of\s*Liberty|Times\s*Square|Grand\s*Canyon|Niagara\s*Falls|Glacier\s*Bay|Alaska|Space\s*Needle|Pike\s*Place)\b/i

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
    return false
  }

  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(dest)) {
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
  return false
}
