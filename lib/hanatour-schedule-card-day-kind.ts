/**
 * REGRESSION-FREEZE[gemini-client-client-bundle]: 하나투어 일차 유형 — gemini·등록 파서 무import — manifest
 * admin register preview(클라이언트) imageKeyword 경로가 parse-and-register-hanatour-schedule을 당기지 않도록 분리.
 */

/** 하나투어 일정 카드 title/description 제미나이 polish용 일차 유형(코드가 먼저 분류). */
export type HanatourScheduleCardDayKind = 'movement' | 'tourism' | 'return_home'

export function inferHanatourMovementTitle(joined: string, day: number, maxDay: number): string | null {
  const head = joined.slice(0, 14_000)
  const dest =
    /연길|YNJ/i.test(head) ? '연길' : /상해|PVG|푸동/i.test(head) ? '상해' : /방콕|BKK/i.test(head) ? '방콕' : null
  if (
    day === 1 &&
    /(PVG|푸동국제공항|상해\s*푸동|상해.*공항)/i.test(head) &&
    /(입국|도착)/.test(head) &&
    /(미팅|피켓|하나투어|가이드)/i.test(head)
  ) {
    return dest ? `${dest} 입국 및 미팅` : `현지 입국 및 미팅`
  }
  if (day === 1 && /ICN\s*출발|인천(?:공항)?.*출발/i.test(head) && /도착|PVG|YNJ|CJU|GMP|김포/i.test(head)) {
    if (dest) return `인천 출발 및 ${dest} 도착`
  }
  if (
    day === maxDay &&
    maxDay >= 1 &&
    /ICN\s*도착|인천(?:공항)?.*도착|서울\s*ICN\s*도착/i.test(head) &&
    /출발/.test(head)
  ) {
    const from = /연길.*출발|YNJ.*출발/i.test(head)
      ? '연길'
      : /상해.*출발|PVG.*출발/i.test(head)
        ? '상해'
        : /주가각/.test(head)
          ? '주가각'
          : dest ?? '현지'
    return `${from} 출발 및 인천 귀국`
  }
  return null
}

/** 본문에 관광·방문·탐방 근거가 있는지(이동일 전용 판별에 사용). */
export function hanatourJoinedHasTourismEvidence(joined: string): boolean {
  const j = joined.slice(0, 14_000)
  return /(관광|방문|탐방|둘러보|명소|유람|데이투어|체험|포토|쇼핑\s*센터|사진\s*타임)/.test(j)
}

/** 공항·출발·도착·입국·미팅·숙소방향·귀국 등 이동 신호(2개 이상 또는 1일차 입국+공항). */
export function hanatourMovementSignalsStrong(joined: string, day: number): boolean {
  const j = joined.slice(0, 12_000)
  const hits = [
    /공항|ICN|PVG|GMP|김포|국제선|국내선/.test(j),
    /출발/.test(j),
    /도착|입국/.test(j),
    /미팅|피켓|하나투어|가이드/.test(j),
    /호텔로|호텔\s*로|숙소|투숙|체류\s*지/.test(j),
    /귀국|인천\s*도착|ICN\s*도착/.test(j),
  ].filter(Boolean).length
  if (day === 1) {
    if (hits >= 2) return true
    if (/(입국|도착)/.test(j) && /(공항|ICN|PVG|GMP|푸동)/.test(j)) return true
    if (/(미팅|피켓|하나투어)/.test(j) && /(공항|입국|도착|PVG|푸동)/.test(j)) return true
  }
  return hits >= 2
}

export function isHanatourMovementPatternDay(joined: string, day: number, maxDay: number): boolean {
  const j = joined.slice(0, 12_000)
  if (day === maxDay && maxDay >= 2 && /(귀국|인천\s*도착|ICN\s*도착|서울\s*도착)/.test(j) && /출발/.test(j)) return true
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ)/.test(j)
  )
    return true
  if (day === 1 && /출발/.test(j) && /(도착|입국)/.test(j) && /(공항|ICN|PVG|GMP|김포|인천)/.test(j)) return true
  if (
    day === 1 &&
    /(입국|도착|공항|피켓|미팅)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|김포)/.test(j) &&
    /(하나투어|가이드|호텔|공항)/.test(j)
  )
    return true
  if (day === 1 && hanatourMovementSignalsStrong(j, 1) && !hanatourJoinedHasTourismEvidence(j)) return true
  if (day === 1 && /출입국/u.test(j) && !/(귀국|출국)/u.test(j)) return true
  return false
}

export function classifyHanatourScheduleCardDayKind(
  day: number,
  maxDay: number,
  joined: string
): HanatourScheduleCardDayKind {
  const j = joined.slice(0, 12_000)
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(?:귀국|귀국편)/u.test(j) &&
    /(?:출발|공항|ICN|인천|김포|GMP|신치토세|Chitose|CTS)/u.test(j)
  ) {
    return 'return_home'
  }
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ)/.test(j)
  ) {
    return 'return_home'
  }
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(?:귀국|인천|ICN|김포|GMP)(?:\s*국제)?\s*공항?\s*도착/u.test(j)
  ) {
    return 'return_home'
  }
  /** 마지막 일차 routeText·본문에 국내 허브(인천 등)만 있어도 귀국일 — LLM title 가격 오염 시에도 웡타이신 등 당일 POI 우선 */
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ|김해)/u.test(j) &&
    /(?:홍콩|마카오|Macau|Hong\s*Kong|방콕|Bangkok|오사카|Osaka|도쿄|Tokyo|타이베이|Taipei|싱가포르|Singapore|다낭|Da\s*Nang|푸켓|Phuket)/iu.test(
      j,
    )
  ) {
    return 'return_home'
  }
  if (inferHanatourMovementTitle(j, day, maxDay) != null || isHanatourMovementPatternDay(j, day, maxDay)) {
    return 'movement'
  }
  return 'tourism'
}
