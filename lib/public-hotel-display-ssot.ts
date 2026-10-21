/**
 * 공개 상세·일정 카드 — 호텔 한 줄 표시 SSOT.
 * 공급사 갤러리 슬러시 나열·「호텔소개」·국내출발 허브 「부산 예정 호텔」 등을 걸러 숙소명만 남긴다.
 *
 * REGRESSION-FREEZE[public-hotel-display-scrub]: 공개 호텔 한 줄 scrub — manifest
 */

const KR_DEPARTURE_SCHEDULED_HOTEL_RE =
  /^(?:부산|대구|청주|김해|김포|인천)(?:공항)?\s*예정\s*호텔(?:\s*[（(][^）)]*[）)])?\s*$/u

const CHROME_ONLY_RE =
  /^(?:정보\s*보기|상세\s*정보|호텔소개|호텔\s*소개|호텔\s*정보|객실사진|객실\s*사진|부대시설|외관|더보기)$/iu

const CHROME_FRAGMENT_RE =
  /^(?:정보\s*보기|상세\s*정보|호텔소개|호텔\s*소개|호텔\s*정보|객실사진|객실\s*사진|부대시설|외관|더보기|객실(?:\s*정보)?)$/iu

const COUNT_PLACEHOLDER_RE = /총\s*\d+\s*개의\s*예정\s*호텔/iu

/** 갤러리·카탈로그 조각 (숙소명 아님) */
function isChromeHotelFragment(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (CHROME_FRAGMENT_RE.test(t)) return true
  if (/_(?:객실|부대시설|외관)\b/i.test(t)) return true
  if (/^객실\b/u.test(t) && t.length <= 24) return true
  if (/아름다운|즐기는|특별 체험|레이스 체험/u.test(t) && !/(호텔|Hotel|Resort|리조트)/i.test(t)) {
    return true
  }
  return false
}

function looksLikeHotelName(s: string): boolean {
  const t = s.trim()
  if (t.length < 2 || t.length > 90) return false
  if (isChromeHotelFragment(t)) return false
  if (KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(t)) return false
  if (COUNT_PLACEHOLDER_RE.test(t)) return false
  if (/(호텔|Hotel|Resort|리조트|旅館|Ryokan|Inn\b|Lodge|Villa)/i.test(t)) return true
  // 영문 고유명 (HOTEL VISTA Matsuyama 등)
  if (/[A-Za-z]{3,}/.test(t) && !/EX\.|싱글침대|트윈룸/i.test(t)) return true
  return /[가-힣]{2,}/u.test(t) && !/예정\s*호텔|정보\s*보기/u.test(t)
}

/**
 * 공개 호텔 한 줄. 쓰레기·국내출발 허브 placeholder·갤러리 나열이면 null 또는 대표 숙소명 1개.
 */
export function scrubPublicHotelDisplayLine(raw: string | null | undefined): string | null {
  const src = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!src) return null
  if (KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(src)) return null
  if (CHROME_ONLY_RE.test(src)) return null
  if (COUNT_PLACEHOLDER_RE.test(src) && !looksLikeHotelName(src.replace(COUNT_PLACEHOLDER_RE, '').trim())) {
    return null
  }

  const parts = src
    .split(/\s*\/\s*/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !isChromeHotelFragment(p) && !KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(p))

  if (parts.length === 0) return null

  const named = parts.find((p) => looksLikeHotelName(p))
  const pick = (named ?? parts[0]!).trim()
  if (!pick || CHROME_ONLY_RE.test(pick) || KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(pick)) return null

  // 「A 또는 동급」은 유지, 과도한 설명 꼬리 절단
  let out = pick
    .replace(/\s*#.*$/, '')
    .replace(/\s*호텔소개\s*$/u, '')
    .replace(/\s*정보\s*보기\s*$/u, '')
    .trim()
  if (out.length > 72) {
    const cut = out.slice(0, 72)
    const breakAt = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('·'), cut.lastIndexOf(','))
    out = `${out.slice(0, breakAt > 28 ? breakAt : 72).trimEnd()}…`
  }
  return out || null
}

/** dayHotelPlans.hotels[] 공개 정리 — 빈 배열이면 [] */
export function scrubPublicHotelNameList(names: readonly string[] | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of names ?? []) {
    const scrubbed = scrubPublicHotelDisplayLine(raw)
    if (!scrubbed) continue
    const key = scrubbed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(scrubbed)
    if (out.length >= 3) break
  }
  return out
}
