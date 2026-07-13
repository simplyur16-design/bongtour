/**
 * 등록 schedule imageKeyword — 대륙·목적지 불일치 랜드마크 환각 차단 (6공급사 공용).
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: inferRegisterEffectiveProductDestination — manifest
 * REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 유럽 목적지 아시아 키워드 차단 — manifest
 */
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|오키나와|Okinawa|미야코|Miyako|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|방콕|Bangkok|파타야|Pattaya|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii|다낭|Da\s*Nang|오사카|Osaka|도쿄|Tokyo|상해|Shanghai|북경|Beijing/i

export const EUROPE_PRODUCT_DEST_RE =
  /유럽|Europe|서유럽|동유럽|북유럽|남유럽|중동유럽|발트|Baltic|스칸디|Scandinav|지중해|Mediterranean|프랑스|France|이탈리아|Italy|스페인|Spain|독일|Germany|스위스|Switzerland|영국|Britain|UK|아일랜드|Ireland|그리스|Greece|터키|Turkey|크로아티아|Croatia|체코|Czech|Austria|오스트리아|헝가리|Hungary|폴란드|Poland|네덜란드|Netherlands|벨기에|Belgium|포르투갈|Portugal|노르웨이|Norway|스웨덴|Sweden|핀란드|Finland|덴마크|Denmark|아이슬란드|Iceland|리투아니아|Lithuania|에스토니아|Estonia|라트비아|Latvia|빌니우스|Vilnius|탈린|Tallinn|리가|Riga|프라하|Prague|파리|Paris|로마|Rome|런던|London|바르셀로나|Barcelona|인터라켄|Interlaken|융프라우|Jungfrau|피렌체|Florence|베네치아|Venice|취리히|Zurich|암스테르담|Amsterdam|비엔나|Vienna|부다페스트|Budapest|바르샤바|Warsaw|헬싱키|Helsinki|스톡홀름|Stockholm|코펜하겐|Copenhagen|Oslo|오슬로|Reykjavik|베르겐|Bergen|플롬|Flam|Flåm/i

export const AMERICAS_PRODUCT_DEST_RE =
  /미국|USA|U\.S\.|Canada|캐나다|멕시코|Mexico|브라질|Brazil|아르헨|Argentina|칠레|Chile|페루|Peru|Colombia|콜롬비아|남미|북미|중남미|South\s*America|North\s*America|Latin\s*America|하와이|Hawaii|괌|Guam|사이판|Saipan|Los\s*Angeles|LA|뉴욕|New\s*York|샌프란|San\s*Francisco|라스베가스|Las\s*Vegas|시애틀|Seattle|밴쿠버|Vancouver|토론토|Toronto|리마|Lima|마나우스|Manaus|리우\s*데|리오\s*데|Rio\s*de\s*Janeiro|Mexico\s*City|과달라하라|Guadalajara/i
// REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: bare 리우/Rio 제거 — manifest

export const MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE =
  /중동|Middle\s*East|두바이|Dubai|Abu\s*Dhabi|이집트|Egypt|카이로|Cairo|룩소르|Luxor|모로코|Morocco|케냐|Kenya|남아|South\s*Africa|아프리카|Africa|탄자니아|Tanzania|에티오피아|Ethiopia|요르단|Jordan|이스라엘|Israel|카타르|Qatar|오만|Oman|튀니지|Tunisia|나미비아|Namibia|보츠와나|Botswana|Zimbabwe|잠비아|Zambia|우간다|Uganda|르완다|Rwanda|Senegal|세네갈|가나|Ghana|나이지리아|Nigeria/i

const GENERIC_PRODUCT_DEST_RE = /^(?:미지정|미정|기타|해외|overseas|unknown)$/i

const CROSS_CONTINENT_HALLUCINATION_KW_RES: ReadonlyArray<RegExp> = [
  /\bParis\b/i,
  /\bEiffel\b/i,
  /\bLouvre\b/i,
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
]

const JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE =
  /\b(Osaka(?:\s*Castle)?|Tokyo(?:\s*Disneyland)?|Kyoto|Dotonbori|Shibuya|Harajuku|Fushimi|Kinkakuji|Ginkakuji|Mount\s*Fuji|Fuji|Nara)\b/i

const ASIA_PACIFIC_HALLUCINATION_ON_NON_ASIA_DEST_RE =
  /\b(Phuket|Pattaya|Bangkok|Bali|Hoi\s*An|Da\s*Nang|Chiang\s*Mai|Singapore|Maldives|Nha\s*Trang)\b/i

const AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE =
  /\b(Christ\s*the\s*Redeemer|Griffith\s*Observatory|Golden\s*Gate|Statue\s*of\s*Liberty|Times\s*Square|Grand\s*Canyon|Niagara\s*Falls)\b/i

export type RegisterScheduleTripDestinationRow = {
  routeText?: string | null
  title?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

/** primaryDestination 미지정 — 일정 routeText·키워드에서 목적지 대륙 힌트 SSOT */
export function inferRegisterEffectiveProductDestination(
  productDestination: string | null | undefined,
  rows: readonly RegisterScheduleTripDestinationRow[],
): string {
  const dest = String(productDestination ?? '').trim()
  if (dest && !GENERIC_PRODUCT_DEST_RE.test(dest)) return dest
  const hay = rows
    .flatMap((r) => [r.routeText, r.title, r.description, r.imageKeyword, r.imageKeyword2])
    .filter(Boolean)
    .join('\n')
  if (EUROPE_PRODUCT_DEST_RE.test(hay)) return 'Europe'
  if (AMERICAS_PRODUCT_DEST_RE.test(hay)) return 'Americas'
  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(hay)) return 'Africa'
  if (ASIA_PACIFIC_PRODUCT_DEST_RE.test(hay)) return 'Asia Pacific'
  return dest
}

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

  if (EUROPE_PRODUCT_DEST_RE.test(dest)) {
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    if (haystacks.some((h) => AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE.test(h))) return true
    if (haystacks.some((h) => ASIA_PACIFIC_HALLUCINATION_ON_NON_ASIA_DEST_RE.test(h))) return true
    if (/\bGiza\b/i.test(raw) || /\bPhuket\b/i.test(raw)) return true
    return false
  }

  if (AMERICAS_PRODUCT_DEST_RE.test(dest)) {
    if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    return false
  }

  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(dest)) {
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
    return false
  }

  if (!ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest)) return false
  if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
  if (haystacks.some((h) => AMERICAS_HALLUCINATION_ON_NON_AMERICAS_RE.test(h))) return true
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
  return false
}
