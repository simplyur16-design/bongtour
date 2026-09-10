/**
 * 등록 geo — 다국가·권역 클러스터 SSOT (게이트·셀프힐 공용).
 * Iberia(스페인+포르투갈)는 pairOk. 발틱은 hub(poland) 단독 primary 금지.
 *
 * REGRESSION-FREEZE[register-geo-region-clusters]: 발틱≠poland·권역 클러스터 — manifest
 */

/** 클러스터 멤버 증거 (가드와 정합, 순환 import 방지용 로컬). */
const CLUSTER_MEMBER_EVIDENCE: Readonly<Record<string, RegExp>> = {
  lithuania: /리투아니아|lithuania|빌니우스|vilnius|트라카이/i,
  latvia: /라트비아|latvia|리가|\briga\b|룬달레/i,
  estonia: /에스토니아|estonia|탈린|tallinn/i,
  norway: /노르웨이|norway|오슬로|베르겐|플롬/i,
  sweden: /스웨덴|sweden|스톡홀름/i,
  denmark: /덴마크|denmark|코펜하겐/i,
  finland: /핀란드|finland|헬싱키/i,
  iceland: /아이슬란드|iceland|레이캬비크|요쿨살론/i,
  poland: /폴란드|poland|바르샤바|warsaw|크라쿠프/i,
  spain: /스페인|spain|마드리드|바르셀로나|세비야|그라나다/i,
  portugal: /포르투갈|portugal|리스본|파티마/i,
  czech: /체코|czech|프라하|prague|체스키/i,
  hungary: /헝가리|hungary|부다페스트/i,
  austria: /오스트리아|austria|비엔나|vienna|잘츠|할슈타트/i,
  germany: /독일|germany|프랑크푸르트|뮌헨|베를린/i,
  croatia: /크로아티아|croatia|두브로브니크|스플리트/i,
  slovenia: /슬로베니아|slovenia|블레드/i,
  georgia: /조지아|georgia|트빌리시/i,
  azerbaijan: /아제르|azerbaijan|바쿠/i,
  armenia: /아르메니아|armenia|예레반/i,
  peru: /페루|peru|마추픽추|쿠스코/i,
  bolivia: /볼리비아|bolivia|우유니|라파즈/i,
  brazil: /브라질|brazil|리우/i,
  argentina: /아르헨|argentina|부에노스/i,
  mexico: /멕시코|mexico|칸쿤|치첸/i,
  chile: /칠레|chile|산티아고|이스터/i,
  cuba: /쿠바|cuba|하바나/i,
  ecuador: /에콰도르|ecuador/i,
  colombia: /콜롬비아|colombia/i,
  kenya: /케냐|kenya|나이로비/i,
  tanzania: /탄자니아|tanzania|세렝게티|응고롱고/i,
  'south-africa': /남아공|south\s*africa|케이프타운/i,
  morocco: /모로코|morocco|마라케시/i,
  tunisia: /튀니지|tunisia|튀니스|카이로우안/i,
  egypt: /이집트|egypt|카이로(?!우)|룩소르|피라미드/i,
  mauritius: /모리셔스|mauritius/i,
  botswana: /보츠와나|botswana/i,
  zambia: /잠비아|zambia/i,
  zimbabwe: /짐바브웨|zimbabwe/i,
}

export type RegisterGeoRegionCluster = {
  id: string
  regionalKey: string | null
  members: readonly string[]
  hubs?: readonly string[]
  companions?: readonly string[]
  pairOk?: boolean
  requireRegionalWhenMulti?: boolean
  titleMarkers?: RegExp
}

export const REGISTER_GEO_REGION_CLUSTERS: readonly RegisterGeoRegionCluster[] = [
  {
    id: 'nordic_baltic',
    regionalKey: 'nordic-baltic',
    members: [
      'lithuania',
      'latvia',
      'estonia',
      'norway',
      'sweden',
      'denmark',
      'finland',
      'iceland',
    ],
    hubs: ['poland'],
    requireRegionalWhenMulti: true,
    titleMarkers: /발틱|발트\s*3|발트3국|북유럽|스칸디|nordic|\bbaltic\b/i,
  },
  {
    id: 'iberia',
    regionalKey: null,
    members: ['spain', 'portugal'],
    pairOk: true,
    titleMarkers: /이베리아|스페인\s*[/·,]?\s*포르투갈|포르투갈\s*[/·,]?\s*스페인/i,
  },
  {
    id: 'eastern_europe',
    regionalKey: null,
    members: ['czech', 'hungary', 'poland', 'croatia', 'slovenia'],
    companions: ['austria', 'germany'],
    pairOk: true,
    titleMarkers: /동유럽|체오헝|비세그라드/i,
  },
  {
    id: 'caucasus',
    regionalKey: 'caucasus',
    members: ['georgia', 'azerbaijan', 'armenia'],
    requireRegionalWhenMulti: true,
    titleMarkers: /코카서스|카카서스|caucasus/i,
  },
  {
    id: 'latin_caribbean',
    regionalKey: 'latin-caribbean',
    members: [
      'peru',
      'bolivia',
      'brazil',
      'argentina',
      'mexico',
      'chile',
      'cuba',
      'ecuador',
      'colombia',
    ],
    requireRegionalWhenMulti: true,
    titleMarkers: /중남미|남미|라틴|latin|caribbean|카리브/i,
  },
  {
    id: 'africa',
    regionalKey: 'africa',
    members: [
      'kenya',
      'tanzania',
      'south-africa',
      'morocco',
      'tunisia',
      'egypt',
      'mauritius',
      'botswana',
      'zambia',
      'zimbabwe',
    ],
    requireRegionalWhenMulti: true,
    titleMarkers: /아프리카|\bafrica\b|사파리투어|케냐\s*사파리|세렝게티/i,
  },
]

const BALTIC_CORE = new Set(['lithuania', 'latvia', 'estonia'])

export function countryKeyEvidenceInHay(countryKey: string, hay: string): boolean {
  const ck = countryKey.trim()
  if (!ck || !hay.trim()) return false
  const re = CLUSTER_MEMBER_EVIDENCE[ck]
  if (!re) {
    if (ck === 'nordic-baltic') {
      return /발틱|발트|북유럽|리투아니아|라트비아|에스토니아|빌니우스|리가|탈린|nordic|baltic|스칸디|아이슬란드|노르웨이|스웨덴|덴마크|핀란드|레이캬비크|오슬로|스톡홀름|코펜하겐|헬싱키/i.test(
        hay,
      )
    }
    if (ck === 'latin-caribbean') {
      return /중남미|남미|마추픽추|우유니|리우|칸쿤|latin|모아이/i.test(hay)
    }
    if (ck === 'africa') {
      return /아프리카|케냐|탄자니아|세렝게티|케이프타운|사파리|africa/i.test(hay)
    }
    if (ck === 'caucasus') {
      return /코카서스|조지아|아제르|아르메니아|트빌리시|바쿠|예레반/i.test(hay)
    }
    return false
  }
  return re.test(hay)
}

export function clusterMemberKeysPresentInHay(
  cluster: RegisterGeoRegionCluster,
  hay: string,
): string[] {
  return cluster.members.filter((m) => countryKeyEvidenceInHay(m, hay))
}

export function clusterHubKeysPresentInHay(cluster: RegisterGeoRegionCluster, hay: string): string[] {
  return (cluster.hubs ?? []).filter((h) => countryKeyEvidenceInHay(h, hay))
}

/** hay·제목에서 활성화된 권역 클러스터. */
export function detectActiveRegisterGeoRegionCluster(args: {
  hay: string
  productTitle?: string | null
}): RegisterGeoRegionCluster | null {
  const hay = args.hay.trim()
  const title = String(args.productTitle ?? '')
  if (!hay && !title) return null
  const blob = `${title}\n${hay}`

  let best: { cluster: RegisterGeoRegionCluster; score: number } | null = null
  for (const cluster of REGISTER_GEO_REGION_CLUSTERS) {
    const members = clusterMemberKeysPresentInHay(cluster, hay || title)
    const titleHit = cluster.titleMarkers
      ? cluster.titleMarkers.test(title) || cluster.titleMarkers.test(hay)
      : false
    const balticCoreHits = members.filter((m) => BALTIC_CORE.has(m)).length
    const titleBaltic = /발틱|발트\s*3|발트3국|\bbaltic\b/i.test(blob)
    const titleNordicBroad = /북유럽|스칸디|nordic/i.test(blob)

    // 북유럽·발틱: 단품 아이슬란드/스위스 오발동 금지
    // - 그린델발트 ⊂ "발트" 부분일치 금지 (bare 발트 미사용)
    // - 코펜하겐 경유만으로 denmark+iceland 다국 취급 금지
    if (cluster.id === 'nordic_baltic') {
      const activate =
        balticCoreHits >= 2 ||
        titleBaltic ||
        (titleNordicBroad && (balticCoreHits >= 1 || members.length >= 3))
      if (!activate) continue
    } else {
      if (members.length < 2 && !titleHit) continue
      if (cluster.pairOk && members.length < 2 && !titleHit) continue
    }

    let score = members.length
    if (titleHit) score += 3
    if (cluster.id === 'nordic_baltic' && balticCoreHits >= 2) score += 4
    if (cluster.id === 'nordic_baltic' && titleBaltic) score += 5
    if (!best || score > best.score) best = { cluster, score }
  }
  return best?.cluster ?? null
}

/**
 * 활성 클러스터 대비 countryKey 불일치면 true (게이트 실패).
 */
export function countryKeyIncompatibleWithRegionCluster(args: {
  countryKey: string
  cluster: RegisterGeoRegionCluster
  hay: string
  productTitle?: string | null
}): boolean {
  const ck = args.countryKey.trim()
  if (!ck) return false
  const members = clusterMemberKeysPresentInHay(args.cluster, args.hay)
  const title = String(args.productTitle ?? '')
  const blob = `${title}\n${args.hay}`
  const titleHit = args.cluster.titleMarkers
    ? args.cluster.titleMarkers.test(title) || args.cluster.titleMarkers.test(args.hay)
    : false
  const balticCoreHits = members.filter((m) => BALTIC_CORE.has(m)).length
  const titleBaltic = /발틱|발트\s*3|발트3국|\bbaltic\b/i.test(blob)
  const titleNordicBroad = /북유럽|스칸디|nordic/i.test(blob)

  const multi =
    args.cluster.id === 'nordic_baltic'
      ? balticCoreHits >= 2 ||
        titleBaltic ||
        (titleNordicBroad && (balticCoreHits >= 1 || members.length >= 3))
      : members.length >= 2 || titleHit

  if (args.cluster.pairOk && !args.cluster.requireRegionalWhenMulti) {
    const allowed = new Set<string>([
      ...args.cluster.members,
      ...(args.cluster.companions ?? []),
    ])
    if (args.cluster.regionalKey) allowed.add(args.cluster.regionalKey)
    if (allowed.has(ck) && countryKeyEvidenceInHay(ck, args.hay)) return false
    if (multi && !allowed.has(ck)) return true
    return false
  }

  if (args.cluster.requireRegionalWhenMulti && multi) {
    if (args.cluster.regionalKey && ck === args.cluster.regionalKey) return false
    if ((args.cluster.hubs ?? []).includes(ck)) return true
    if (args.cluster.regionalKey && ck !== args.cluster.regionalKey) return true
    return false
  }

  if (members.length <= 1 && !titleHit) return false
  if ((args.cluster.hubs ?? []).includes(ck) && members.length >= 1 && !members.includes(ck)) {
    return true
  }
  return false
}

export function isPoisonedRegionClusterDestination(dest: string | null | undefined): boolean {
  return /북유럽\s*·\s*발트|발틱3국|register-region-cluster/i.test(String(dest ?? ''))
}

/** 셀프힐용 — 강제 regional / nudge 라벨 */
export function regionClusterHealNudge(cluster: RegisterGeoRegionCluster): {
  regionalKey: string | null
  label: string
} | null {
  if (cluster.regionalKey === 'nordic-baltic') {
    return { regionalKey: 'nordic-baltic', label: '북유럽 · 발트 발틱3국' }
  }
  if (cluster.regionalKey === 'latin-caribbean') {
    return { regionalKey: 'latin-caribbean', label: '중남미' }
  }
  if (cluster.regionalKey === 'africa') {
    return { regionalKey: 'africa', label: '아프리카' }
  }
  if (cluster.regionalKey === 'caucasus') {
    return { regionalKey: 'caucasus', label: '코카서스' }
  }
  return null
}
