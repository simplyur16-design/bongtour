/**
 * 등록대기 — Product.countryKey(메가메뉴) vs 제목·일정 본문 불일치.
 * dest hay에 countryKey slug를 넣지 않는 기존 계약과 별도 축.
 *
 * REGRESSION-FREEZE[register-pre-photo-product-country-schedule]: countryKey≠일정 나라 — manifest
 */
import type { RegisterPrePhotoHealRow } from '@/lib/register-pre-photo-guards'
import {
  countryKeyIncompatibleWithRegionCluster,
  detectActiveRegisterGeoRegionCluster,
  REGISTER_GEO_REGION_CLUSTERS,
  clusterMemberKeysPresentInHay,
  isPoisonedRegionClusterDestination,
} from '@/lib/register-geo-region-clusters'
// REGRESSION-FREEZE[register-geo-region-clusters]: 발틱≠poland·권역 클러스터 — manifest

/** countryKey → 일정·제목에 있어야 할 증거 (한/영·도시). */
export const PRODUCT_COUNTRY_KEY_CONTENT_EVIDENCE: Readonly<Record<string, RegExp>> = {
  malaysia:
    /말레이|malaysia|코타키나발루|쿠알라|랑카위|페낭|kota\s*kinabalu|kuala\s*lumpur|langkawi|penang|겐팅|말라카|브루나이|brunei/i,
  vietnam:
    /베트남|vietnam|다낭|da\s*nang|호이안|hoi\s*an|푸꾸옥|phu\s*quoc|나트랑|nha\s*trang|바나힐|ba\s*na|호치민|하노이|하롱/i,
  philippines:
    /필리핀|philippines|보라카이|boracay|세부|cebu|칼리보|마닐라|보홀|bohol/i,
  china:
    /중국|china|장가계|태항|제남|보천|서안|내몽골|오르도스|청도|qingdao|베이징|상해|상하이|항주|구이린|황산|대련/i,
  canada:
    /캐나다|canada|나이아가라|niagara|토론토|toronto|퀘벡|quebec|몬트리올|montreal|밴쿠버|vancouver/i,
  'united-states':
    /미국|미동부|미서부|뉴욕|워싱턴|하와이|\busa\b|new\s*york|hawaii|로스앤젤레스|라스베가스|시애틀/i,
  'usa-west': /미서부|로스앤젤레스|라스베가스|시애틀|샌프란|요세미티|그랜드캐년/i,
  lithuania: /리투아니아|lithuania|빌니우스|vilnius|트라카이|trakai/i,
  latvia: /라트비아|latvia|리가|\briga\b|룬달레|rundale/i,
  estonia: /에스토니아|estonia|탈린|tallinn/i,
  poland: /폴란드|poland|바르샤바|warsaw|크라쿠프|krakow/i,
  czech: /체코|czech|프라하|prague|체스키|cesky/i,
  austria: /오스트리아|austria|비엔나|vienna|잘츠|할슈타트|hallstatt|쇤브룬/i,
  hungary: /헝가리|hungary|부다페스트|budapest/i,
  turkey: /터키|튀르키예|turkey|이스탄불|istanbul|카파도키아|파묵칼레|에페소|안탈리아/i,
  italy: /이탈리아|이태리|italy|로마|\brome\b|베니스|피렌체|시칠리아|밀라노|콜로세움|colosseum|카타니아|팔레르모|타오르미나|아그리젠토|시라쿠사|몰타|\bmalta\b/i,
  spain: /스페인|spain|마드리드|madrid|바르셀로나|barcelona|세비야|그라나다|톨레도|알람브라/i,
  portugal: /포르투갈|portugal|리스본|lisbon|파티마|fatima|포르투(?!\s*유럽)/i,
  japan:
    /일본|japan|오사카|도쿄|후쿠오카|유후인|오키나와|규슈|홋카이도|북해도|교토|나라|고베|삿포로|나하|츄라우미|도야코|비에이|아사히카와|유후인|벳푸|구마모토/i,
  singapore: /싱가포르|singapore|센토사|sentosa|마리나\s*베이|merlion/i,
  thailand: /태국|thailand|방콕|bangkok|푸켓|phuket|치앙마이|파타야/i,
  indonesia: /인도네시아|indonesia|발리|bali|자카르타|족자/i,
  cambodia: /캄보디아|cambodia|앙코르|씨엠립|siem\s*reap/i,
  'hong-kong': /홍콩|hong\s*kong/i,
  macau: /마카오|macau|macao/i,
  taiwan: /대만|taiwan|타이베이|taipei|타이중|가오슝/i,
  australia: /호주|australia|시드니|sydney|멜버른|골드코스트|브리즈번/i,
  'new-zealand': /뉴질랜드|new\s*zealand|오클랜드|퀸즈타운/i,
  // 니스: 비즈니스 부분일치 금지
  france: /프랑스|france|파리|paris|(?<![가-힣])니스(?![가-힣])|프로방스|마르세유|몽생미셸/i,
  germany: /독일|germany|프랑크푸르트|뮌헨|베를린|쾰른|하이델베르크/i,
  switzerland: /스위스|switzerland|인터라켄|루체른|취리히|체르마트|융프라우/i,
  'united-kingdom': /영국|britain|\buk\b|런던|london|에딘버러|스톤헨지/i,
  greece: /그리스|greece|아테네|athens|산토리니|미코노스/i,
  iceland: /아이슬란드|iceland|레이캬비크|블루라군|요쿨살론/i,
  egypt: /이집트|egypt|카이로(?!우)|cairo|룩소르|피라미드|아스완/i,
  mongolia: /몽골|mongolia|울란바토르|테렐지|terelj/i,
  india: /인도(?!네시아)|india|델리|delhi|타지마할|바라나시|아그라/i,
  dubai: /두바이|dubai|아부다비|abu\s*dhabi/i,
  'united-arab-emirates': /아랍에미리트|uae|두바이|dubai|아부다비/i,
  saipan: /사이판|saipan/i,
  guam: /괌|guam/i,
  tunisia: /튀니지|tunisia|튀니스|tunis|카이로우안|kairouan|수스|sousse|카르타고|carthage|토주르|마트마타|스팍스|sfax/i,
  brazil: /브라질|brazil|리우|rio\s*de/i,
  peru: /페루|peru|마추픽추|쿠스코|cusco/i,
  argentina: /아르헨|argentina|부에노스/i,
  bolivia: /볼리비아|bolivia|우유니|라파즈/i,
  mexico: /멕시코|mexico|칸쿤|치첸/i,
  jordan: /요르단|jordan|페트라|petra|와디럼|암만/i,
  kenya: /케냐|kenya|나이로비|nairobi/i,
  tanzania: /탄자니아|tanzania|세렝게티|응고롱고/i,
  'south-africa': /남아공|south\s*africa|케이프타운|cape\s*town/i,
  zambia: /잠비아|zambia|빅토리아\s*폭포/i,
  botswana: /보츠와나|botswana/i,
  zimbabwe: /짐바브웨|zimbabwe/i,
  'nordic-baltic':
    /발틱|발트|북유럽|리투아니아|라트비아|에스토니아|빌니우스|리가|탈린|nordic|baltic|스칸디|아이슬란드|노르웨이|스웨덴|덴마크|핀란드|레이캬비크|오슬로|스톡홀름|코펜하겐|헬싱키/i,
  'latin-caribbean': /중남미|남미|마추픽추|우유니|리우|칸쿤|모아이|latin|caribbean/i,
  africa: /아프리카|africa|케냐|탄자니아|세렝게티|케이프타운|사파리/i,
  caucasus: /코카서스|카카서스|조지아|아제르|아르메니아|트빌리시|바쿠|예레반/i,
}

/** 일정·제목에서 “강한” 나라 후보 (browse countryKey와 교차 검증). */
const STRONG_OTHER_COUNTRY_HINTS: ReadonlyArray<{ key: string; re: RegExp }> = [
  { key: 'vietnam', re: /베트남|다낭|호이안|푸꾸옥|바나힐|나트랑|da\s*nang|hoi\s*an|phu\s*quoc/i },
  { key: 'philippines', re: /필리핀|보라카이|세부|보홀|boracay|cebu/i },
  { key: 'china', re: /장가계|태항|제남|보천|서안|내몽골|오르도스|청도|베이징|상해/i },
  { key: 'canada', re: /캐나다|나이아가라|토론토|퀘벡|몬트리올/i },
  { key: 'united-states', re: /미동부|뉴욕|워싱턴|하와이|센트럴\s*파크|백악관/i },
  { key: 'lithuania', re: /빌니우스|트라카이|리투아니아/i },
  { key: 'latvia', re: /리가|라트비아|룬달레/i },
  { key: 'estonia', re: /탈린|에스토니아/i },
  { key: 'czech', re: /프라하|체스키|체코/i },
  { key: 'austria', re: /비엔나|잘츠|할슈타트|쇤브룬|오스트리아/i },
  { key: 'hungary', re: /부다페스트|헝가리/i },
  { key: 'turkey', re: /이스탄불|카파도키아|파묵칼레|에페소|튀르키예|터키/i },
  { key: 'italy', re: /로마|베니스|피렌체|시칠리아|이탈리아|이태리|콜로세움/i },
  { key: 'spain', re: /마드리드|바르셀로나|세비야|그라나다|스페인/i },
  { key: 'portugal', re: /리스본|파티마|포르투갈/i },
  { key: 'japan', re: /오사카|도쿄|후쿠오카|유후인|오키나와|교토|일본|홋카이도|북해도|삿포로/i },
  { key: 'malaysia', re: /코타키나발루|쿠알라룸푸르|랑카위|말레이시아/i },
  { key: 'france', re: /파리|프로방스|(?<![가-힣])니스(?![가-힣])|마르세유|프랑스/i },
  { key: 'switzerland', re: /인터라켄|루체른|취리히|체르마트|스위스/i },
  { key: 'germany', re: /프랑크푸르트|뮌헨|독일|쾰른/i },
  { key: 'egypt', re: /이집트|카이로(?!우)|룩소르|피라미드/i },
  { key: 'iceland', re: /아이슬란드|레이캬비크|요쿨살론/i },
  { key: 'australia', re: /시드니|호주|멜버른|골드코스트/i },
  { key: 'mongolia', re: /몽골|울란바토르|테렐지/i },
  { key: 'india', re: /타지마할|델리|바라나시|아그라|(?<!네시)인도(?!네시아)/i },
]

export function registerPrePhotoScheduleCountryHaystack(
  productTitle?: string | null,
  productDestination?: string | null,
  rows?: readonly RegisterPrePhotoHealRow[] | null,
): string {
  const parts: string[] = [String(productTitle ?? ''), String(productDestination ?? '')]
  for (const row of rows ?? []) {
    // imageKeyword·day title 환각(예: 귀국일 title=쿠알라룸푸르)은 countryKey 증거에서 제외.
    // REGRESSION-FREEZE[register-pre-photo-product-country-schedule]: day title 쿠알라룸푸르 독 금지 — manifest
    parts.push(String(row.routeText ?? ''), String(row.description ?? ''))
  }
  return parts.join('\n')
}

export function countryKeyHasContentEvidence(countryKey: string | null | undefined, hay: string): boolean {
  const ck = String(countryKey ?? '').trim()
  if (!ck || !hay.trim()) return true
  const re = PRODUCT_COUNTRY_KEY_CONTENT_EVIDENCE[ck]
  if (!re) return true
  return re.test(hay)
}

export function strongOtherCountryKeysFromHay(
  hay: string,
  excludeCountryKey?: string | null,
): string[] {
  const exclude = String(excludeCountryKey ?? '').trim()
  const out: string[] = []
  for (const { key, re } of STRONG_OTHER_COUNTRY_HINTS) {
    if (key === exclude) continue
    if (re.test(hay)) out.push(key)
  }
  return out
}

function registerPrePhotoScheduleBodyHaystack(
  rows?: readonly RegisterPrePhotoHealRow[] | null,
): string {
  const parts: string[] = []
  for (const row of rows ?? []) {
    parts.push(String(row.routeText ?? ''), String(row.description ?? ''))
  }
  return parts.join('\n')
}

/**
 * countryKey가 본문에 없고, 다른 나라가 강하게 보이면 등록대기 금지.
 * 다국가(스페인+포르투갈 등)는 저장키가 한쪽이어도 본문에 그 키 증거가 있으면 통과.
 * 발틱3국 등 권역 다국가는 hub(poland) 또는 단일국 키만으로 통과 금지.
 * 제목만 countryKey·일정 본문은 타국이면 금지 (메가메뉴/제목 독).
 */
export function productCountryScheduleMismatchIssues(args: {
  countryKey?: string | null
  productTitle?: string | null
  productDestination?: string | null
  rows: readonly RegisterPrePhotoHealRow[]
}): string[] {
  const ck = String(args.countryKey ?? '').trim()
  if (!ck) return []
  const destForHay = isPoisonedRegionClusterDestination(args.productDestination)
    ? ''
    : args.productDestination
  const hay = registerPrePhotoScheduleCountryHaystack(
    args.productTitle,
    destForHay,
    args.rows,
  )
  if (!hay.trim()) return []
  const bodyHay = registerPrePhotoScheduleBodyHaystack(args.rows)
  const othersInFull = strongOtherCountryKeysFromHay(hay, ck)
  const othersInBody = strongOtherCountryKeysFromHay(bodyHay, ck)
  const ckInFull = countryKeyHasContentEvidence(ck, hay)
  const ckInBody = countryKeyHasContentEvidence(ck, bodyHay)

  // 권역 클러스터 — 발틱≠poland, 중남미≠단일국 등
  // REGRESSION-FREEZE[register-geo-region-clusters]: 발틱≠poland·권역 클러스터 — manifest
  const cluster = detectActiveRegisterGeoRegionCluster({
    hay,
    productTitle: args.productTitle,
  })
  if (
    cluster &&
    countryKeyIncompatibleWithRegionCluster({
      countryKey: ck,
      cluster,
      hay,
      productTitle: args.productTitle,
    })
  ) {
    return ['product_country_schedule_mismatch']
  }

  // 권역키(nordic-baltic 등)가 단품·경유만 있는 상품에 과적용된 경우
  // REGRESSION-FREEZE[register-geo-region-clusters]: 단품≠권역키 과적용 — manifest
  if (!cluster) {
    const regional = REGISTER_GEO_REGION_CLUSTERS.find((c) => c.regionalKey === ck)
    if (regional) {
      const members = clusterMemberKeysPresentInHay(regional, hay)
      const balticCore = members.filter((m) =>
        m === 'lithuania' || m === 'latvia' || m === 'estonia',
      ).length
      const titleBaltic = /발틱|발트\s*3|발트3국|\bbaltic\b/i.test(
        `${args.productTitle ?? ''}\n${hay}`,
      )
      if (regional.regionalKey === 'nordic-baltic') {
        if (balticCore < 2 && !titleBaltic) {
          return ['product_country_schedule_mismatch']
        }
      } else if (members.length <= 1) {
        return ['product_country_schedule_mismatch']
      }
    }
  }

  // 일정 본문에 타국이 강하고 countryKey 증거가 본문에 없으면 — 제목만 맞는 메가메뉴 독 차단
  // REGRESSION-FREEZE[register-pre-photo-product-country-schedule]: 제목만 ck·본문 타국 — manifest
  if (bodyHay.trim() && othersInBody.length > 0 && !ckInBody) {
    return ['product_country_schedule_mismatch']
  }

  if (ckInFull) return []
  if (othersInFull.length === 0) return []
  return ['product_country_schedule_mismatch']
}
