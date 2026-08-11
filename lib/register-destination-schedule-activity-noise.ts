/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: schedule activity ≠ destination place — manifest
 * 일정 places(호핑·라운지·자유일정 등)가 primaryDestination/destinationRaw에 섞이지 않게 한다.
 */
import {
  isRegisterDestinationTourStyleNoiseToken,
  scrubRegisterDestinationTourStyleHead,
} from '@/lib/register-destination-tour-style-noise'

/** 일정 액티비티·체험 라벨 — 방문 도시/국가 destination 토큰으로 쓰지 않음 */
export function isRegisterDestinationScheduleActivityToken(token: string): boolean {
  const t = String(token ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return true
  // REGRESSION-FREEZE[register-destination-reject-ilju]: 호핑·라운지·자유일정 ≠ 도시 — manifest
  if (/(?:아일랜드\s*)?호핑|island\s*hopping|해적\s*호핑|hopping\s*tour/i.test(t)) return true
  if (/라운지|lounge/i.test(t)) return true
  if (/자유\s*(?:일정|시간|관광)|자유일정|free\s*time|at\s+leisure/i.test(t)) return true
  if (/선택\s*(?:관광|투어)|옵션\s*투어|추천\s*선택/i.test(t)) return true
  if (/밍글링|mingling|레이트\s*체크|late\s*night|sunset\s*chill/i.test(t)) return true
  if (/(?:전신\s*)?마사지|(?:힐링\s*)?스파|문\s*스파/i.test(t) && !/(온천|온센)/i.test(t)) return true
  if (/골프\s*(?:투어|장)?$|쇼핑\s*(?:투어|타임)|아울렛\s*쇼핑/i.test(t)) return true
  if (/^(?:시내\s*)?(?:관광|투어|체험|관람)$/u.test(t)) return true
  if (/체크\s*인|체크\s*아웃|호텔\s*이동|기내\s*식/i.test(t)) return true
  if (/공항|airport|유의사항|안내\s*사항|정보\s*안내|입국\s*조건|필요\s*서류|여행전\s*준비|현지\s*행사\s*안내/i.test(t)) {
    return true
  }
  if (/카페|cafe|비치\s*클럽|beach\s*club|루프\s*탑\s*바|네일\s*아트/i.test(t)) return true
  if (/쇼핑몰|shopping\s*mall|아울렛|outlet|면세점/i.test(t)) return true
  if (/반딧불|firefl|나들이\s*투어|플로팅\s*선셋|선셋\s*투어|시티\s*투어$/i.test(t)) return true
  if (/(?:체험|관람|시음)\s*투어$|(?:달빛|야경|야간)\s*투어$/u.test(t)) return true
  return false
}

export function splitRegisterDestinationPlaceTokens(raw: string): string[] {
  const base = String(raw ?? '')
    .replace(/\s*외\s*\d+\s*도시\s*$/u, '')
    .replace(/\s*외\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return []
  return base
    .split(/[,，、/／·|+]/)
    .map((p) =>
      scrubRegisterDestinationTourStyleHead(
        p
          .replace(/\s+/g, ' ')
          .replace(/^\(+|\)+$/g, '')
          .trim(),
      ),
    )
    .filter((p) => p.length >= 2 && !/^\d+$/.test(p))
}

/** 도시·지명 후보만 남김 (일주·호핑·라운지 등 제거) */
export function filterRegisterDestinationPlaceTokens(tokens: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of tokens) {
    const t = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (t.length < 2) continue
    if (isRegisterDestinationTourStyleNoiseToken(t)) continue
    if (isRegisterDestinationScheduleActivityToken(t)) continue
    if (/^(?:인천|ICN|서울|김포|한국)$/i.test(t)) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/**
 * 조합 라벨(`코타키나발루 · 아일랜드 호핑 외 2도시`) → 지명만.
 * 액티비티만 남으면 null.
 */
export function scrubRegisterDestinationComposedPlaceLabel(raw: string | null | undefined): string | null {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  const places = filterRegisterDestinationPlaceTokens(splitRegisterDestinationPlaceTokens(t))
  if (places.length === 0) return null
  if (places.length <= 3) return places.join(' · ').slice(0, 96)
  return `${places.slice(0, 2).join(' · ')} 외 ${places.length - 2}도시`.slice(0, 96)
}

/** destinationRaw용 — 콤마 목록으로 정리 */
export function scrubRegisterDestinationRawPlaceList(raw: string | null | undefined): string | null {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  const places = filterRegisterDestinationPlaceTokens(splitRegisterDestinationPlaceTokens(t))
  if (places.length === 0) return null
  return places.join(', ').slice(0, 500)
}

/** 일정 day.places → travelCitiesRaw (액티비티 제외) */
export function factSchedulePlacesToTravelCitiesRaw(
  days: ReadonlyArray<{ places?: readonly string[] | null }>,
): string | null {
  const out: string[] = []
  const seen = new Set<string>()
  for (const day of days) {
    for (const raw of day.places ?? []) {
      const label = String(raw ?? '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (label.length < 2 || label.length > 80) continue
      if (/^(?:인천|ICN|서울|김포|공항|출발|도착)$/i.test(label)) continue
      if (/조식|중식|석식|기내/i.test(label)) continue
      if (isRegisterDestinationScheduleActivityToken(label)) continue
      if (isRegisterDestinationTourStyleNoiseToken(label)) continue
      const key = label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(label)
    }
  }
  return out.length > 0 ? out.slice(0, 15).join(', ') : null
}
