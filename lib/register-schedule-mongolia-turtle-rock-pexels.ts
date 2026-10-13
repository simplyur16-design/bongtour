/**
 * 몽골 거북이바위(Melkhii Khad / Turtle Rock) — Pexels 검색·후보 점수 SSOT.
 *
 * 실측 (2026-10-10, landscape, 사람 간격 순차 + 이미지 육안):
 * - bare "Turtle Rock" → 연못 거북이·동물 스톡 (animalN≈8)
 * - "Melkhii Khad" 단독 → 명소 재고 거의 없음
 * - finalize 가 trailing "landscape" 를 잘라 "Terelj Mongolia Rocky" 로 붕괴 → Hills 사용
 * - primary "Terelj Mongolia Rocky Hills" 가 실사 거북이바위형 바위(예: pexels 31694814)를 포함
 * - 고해상도만 보면 Arkhangai 초원·게르(28103660)가 이기므로 alt/URL 점수·거절 필수
 *
 * REGRESSION-FREEZE[register-schedule-mongolia-turtle-rock-terelj]: Pexels 실측 검색어 — manifest
 */

/** schedule imageKeyword + Pexels primary */
export const MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD = 'Terelj Mongolia Rocky Hills'

/**
 * secondary — 실측으로 31694814·33458470 등 바위 컷을 추가로 끌어옴.
 * (동물 Turtle Rock / 내몽골 오매칭은 평가 단계에서 거절)
 */
export const MONGOLIA_TURTLE_ROCK_PEXELS_SECONDARIES = [
  'Ulaanbaatar Terelj Rock Formation',
  'Terelj rock formation Mongolia landscape',
  'Melkhii Khad Terelj',
  'Gorkhi Terelj Mongolia Rocks',
] as const

/** 동물·약한 Turtle Rock / Melkhii 계열 → 실측 키워드 */
const WEAK_TURTLE_ROCK_RE =
  /^(?:Turtle\s*Rock(?:\s+Terelj(?:\s+Mongolia)?)?|Melkhii\s*Khad(?:\s+(?:Mongolia|Terelj))?|Terelj\s+Mongolia\s+(?:rocky\s+landscape|Rocky))$/i

export function qualifyMongoliaTurtleRockPexelsKeyword(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t === MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD) return t
  if (MONGOLIA_TURTLE_ROCK_PEXELS_SECONDARIES.some((s) => s === t)) return t
  if (WEAK_TURTLE_ROCK_RE.test(t)) return MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD
  if (/거북이?\s*바위/u.test(t)) return MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD
  if (/Turtle\s*Rock|Melkhii\s*Khad/i.test(t)) {
    if (!/Rocky\s*Hills|Rock\s*Formation|Rock\s*Outcrop|Gorkhi\s*Terelj|Terelj\s+rock\s+formation/i.test(t)) {
      return MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD
    }
  }
  return t
}

export function isMongoliaTurtleRockPexelsKeyword(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').trim()
  if (!t) return false
  if (t === MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD) return true
  if (MONGOLIA_TURTLE_ROCK_PEXELS_SECONDARIES.some((s) => s === t)) return true
  if (WEAK_TURTLE_ROCK_RE.test(t)) return true
  if (/거북이?\s*바위/u.test(t)) return true
  return /Turtle\s*Rock|Melkhii\s*Khad/i.test(t)
}

/** alt/URL 이 연못 거북이·거북류이면 몽골 바위 후보에서 제외 */
export function isAnimalTurtlePexelsHit(altOrPage: string | null | undefined): boolean {
  const h = String(altOrPage ?? '').toLowerCase()
  if (!h.trim()) return false
  if (/\b(sea\s*turtle|tortoise|terrapin|box\s*turtle)\b/.test(h)) return true
  if (/\bturtles?\b/.test(h) && /\b(pond|basking|water|wildlife|reptile)\b/.test(h)) return true
  if (/\bturtles?\s+on\s+(a\s+)?rock\b/.test(h)) return true
  return false
}

/** Terelj 검색인데 내몽골·오르도스 등 오매칭 */
export function isOffTripInnerMongoliaPexelsHit(altOrPage: string | null | undefined): boolean {
  const h = String(altOrPage ?? '').toLowerCase()
  return /inner\s*mongolia|xilingol|ordos|xiangshawan|후룬베이얼|내몽골/.test(h)
}

/** Terelj 거북이바위 검색인데 타국·타주 바위 */
export function isWrongGeoForMongoliaTurtleRockPexelsHit(
  altOrPage: string | null | undefined,
): boolean {
  const h = String(altOrPage ?? '').toLowerCase()
  if (!h.trim()) return false
  if (isOffTripInnerMongoliaPexelsHit(h)) return true
  // 몽골 안이어도 Terelj/울란바토르 권이 아닌 명시 지역
  if (
    /\b(arkhangai|ikh[- ]?tamir|bayan[- ]?unjuul|khovd|uvs|bayankhongor|gobi[- ]?altai|övörkhangai|uvurkhangai)\b/.test(
      h,
    )
  ) {
    return true
  }
  // 타국 바위 명소·내몽골 인접(Ulanqab 등)
  if (
    /\b(chechnya|russia|russian|tibet|nepal|iceland|arizona|utah|canyonlands|zion|yosemite|patagonia|andes|alps|himalaya|cappadocia|joshua\s*tree|moab|ulanqab|china)\b/.test(
      h,
    )
  ) {
    // 몽골·테렐지·울란바토르가 같이 있으면 타국 토큰만으로 거절하지 않음(드묾)
    if (!/\b(mongolia|ulaanbaatar|ulaanbaator|terelj|gorkhi|mongolian)\b/.test(h)) return true
  }
  return false
}

/** 바위 형성·아웃크롭 신호가 있으면 가산 (거북이바위 목적) */
export function mongoliaTurtleRockPexelsRelevanceDelta(
  altOrPage: string | null | undefined,
): { delta: number; bits: string[]; hardReject: boolean } {
  const hay = String(altOrPage ?? '')
  const h = hay.toLowerCase()
  const bits: string[] = []
  if (!h.trim()) return { delta: -20, bits: ['메타없음'], hardReject: false }

  if (isAnimalTurtlePexelsHit(hay)) {
    return { delta: -1000, bits: ['동물거북이거절'], hardReject: true }
  }
  if (isWrongGeoForMongoliaTurtleRockPexelsHit(hay)) {
    return { delta: -1000, bits: ['지오오매칭거절'], hardReject: true }
  }

  let delta = 0
  const mongoliaCue = /\b(mongolia|mongolian|ulaanbaatar|ulaanbaator|terelj|gorkhi|melkhii)\b/.test(h)
  const rockCue =
    /\b(rocky\s+hills?|rock\s+formation|rocky\s+outcrop|rock\s+outcrop|granite|boulder|rocky\s+landscape|rocky\s+terrain|craggy|rugged\s+rock)\b/.test(
      h,
    )
  const softRock = /\b(rock|rocks|hills?|mountain|mountains|cliff)\b/.test(h)
  const livestockOrCamp = /\b(yurt|ger|sheep|grazing|steppe|herd|horses?|camels?|rider|cows?|cattle)\b/.test(
    h,
  )
  const livestockSteppe =
    livestockOrCamp &&
    !/\b(rocky\s+hills?|rock\s+formation|rocky\s+outcrop|rock\s+outcrop)\b/.test(h)
  const rockSlug = /rocky-hills|rocky-outcrop|rock-formation|breathtaking-rocky/i.test(h)

  if (mongoliaCue) {
    delta += 40
    bits.push('몽골지명가산')
  } else if (rockSlug || rockCue) {
    // 실측 31694814 처럼 alt에 지명 없어도 rocky-hills 슬러그면 약감점만
    delta -= 10
    bits.push('몽골지명약함')
  } else {
    delta -= 35
    bits.push('몽골지명없음')
  }
  if (rockCue) {
    delta += 55
    bits.push('바위형성가산')
  } else if (softRock) {
    delta += 15
    bits.push('바위약가산')
  } else {
    delta -= 25
    bits.push('바위신호없음')
  }
  if (livestockSteppe) {
    delta -= 45
    bits.push('초원게르감점')
  } else if (livestockOrCamp && rockCue) {
    // 낙타·말 관광컷보다 순수 바위 형성 컷을 우선 (거북이바위 목적)
    delta -= 32
    bits.push('가축관광감점')
  }
  if (rockSlug) {
    delta += 30
    bits.push('슬러그바위가산')
  }
  if (!livestockOrCamp && rockCue) {
    delta += 35
    bits.push('순수바위가산')
  }
  // 실측 거북이바위형(rocky-hills / breathtaking rocky) > 초원+아웃크롭 광경
  if (/scenic-view-of-rocky-hills|breathtaking\s+rocky\s+landscape/i.test(h)) {
    delta += 28
    bits.push('거북이바위형가산')
  } else if (/vast-grasslands|expansive\s+grasslands/i.test(h) && rockCue) {
    delta -= 20
    bits.push('초원주감점')
  }
  if (/arkhangai|ikh-tamir|bayan-unjuul/i.test(h)) {
    return { delta: -1000, bits: [...bits, '지오오매칭거절'], hardReject: true }
  }

  return { delta, bits, hardReject: false }
}
