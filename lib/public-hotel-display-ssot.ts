/**
 * 공개 상세·일정 카드 — 호텔 한 줄 표시 SSOT.
 * 공급사 갤러리 슬러시 나열·「호텔소개」·국내출발 허브 「부산 예정 호텔」 등을 걸러 숙소명만 남긴다.
 *
 * REGRESSION-FREEZE[public-hotel-display-scrub]: 공개 호텔 한 줄 scrub — manifest
 */

const KR_DEPARTURE_SCHEDULED_HOTEL_RE =
  /^(?:부산|대구|청주|김해|김포|인천)(?:공항)?\s*예정\s*호텔(?:\s*[（(][^）)]*[）)])?\s*$/u

const CHROME_ONLY_RE =
  /^(?:정보\s*보기|상세\s*정보|상세보기|호텔소개|호텔\s*소개|호텔\s*정보|객실사진|객실\s*사진|부대시설|외관|더보기)$/iu

const CHROME_FRAGMENT_RE =
  /^(?:정보\s*보기|상세\s*정보|호텔소개|호텔\s*소개|호텔\s*정보|객실사진|객실\s*사진|부대시설|외관|더보기|객실(?:\s*정보)?)$/iu

const COUNT_PLACEHOLDER_RE = /총\s*\d+\s*개의\s*예정\s*호텔/iu

/** 숙소명이 아닌 변동·안내 문구 */
const HOTEL_NOTICE_RE =
  /^[※*＊]|예정호텔\s*리스트에\s*없는|동급호텔로\s*(?:변동|배정)|소도시\s*특성상|현지\s*사정상|진행가능여부를\s*체크|호텔은\s*예정호텔|본\s*여행상품의\s*호텔|호텔은\s*출발\s*\d|확정\s*시\s*별도(?:로)?\s*안내/u

const DAY_HOTEL_HEADER_RE = /\d+\s*일\s*차\s*(?:예정)?\s*호텔/u

/** 일정 섹션 제목·잡문 헤더 (숙소명 아님) — `날씨 및 호텔` 등 */
const HOTEL_SECTION_HEADING_RE =
  /^(?:날씨\s*및\s*호텔|날씨\/호텔|호텔\s*및\s*날씨|호텔\s*정보|숙소\s*안내|숙박\s*안내|호텔\s*안내)$/u

/** 갤러리·카탈로그 조각 (숙소명 아님) */
function isChromeHotelFragment(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (CHROME_FRAGMENT_RE.test(t)) return true
  if (HOTEL_SECTION_HEADING_RE.test(t)) return true
  if (/날씨\s*및\s*호텔/u.test(t) && t.length <= 24) return true
  if (/_(?:객실|부대시설|외관)\b/i.test(t)) return true
  if (/^객실\b/u.test(t) && t.length <= 24) return true
  if (/아름다운|즐기는|특별 체험|레이스 체험/u.test(t) && !/(호텔|Hotel|Resort|리조트)/i.test(t)) {
    return true
  }
  return false
}

/** 호텔소개·정보보기 이후 잘림 + 선행 숙소명 후보 */
function stripHotelChromeTail(s: string): string {
  return s
    .split(/\s*(?:호텔\s*소개|호텔소개|정보\s*보기)\s*/iu)[0]
    ?.replace(/\d+\s*일\s*차\s*(?:예정)?\s*호텔/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() || ''
}

/** 성급·투숙·UI만 남은 일차 호텔 덩어리 (브랜드명 없음) */
function isGradeOrStayChromeOnly(s: string): boolean {
  const brand =
    /(Hotel|Resort|메리어트|노보텔|힐튼|하얏트|쉐라톤|코트야드|윈덤|Wyndham|Mercure|Pullman|Crowne|Holiday\s*Inn|인터컨티넨탈)/i
  if (brand.test(s)) return false
  const stripped = s
    .replace(/\d+\s*일\s*차\s*(?:예정)?\s*호텔/gu, ' ')
    .replace(/호텔\s*투숙/gu, ' ')
    .replace(/준?\s*[3-5]\s*성\s*급?\s*호텔/gu, ' ')
    .replace(/상세\s*보기/gu, ' ')
    .replace(/숙박\s*없음(?:\([^)]*\))?/gu, ' ')
    .replace(/휴식/gu, ' ')
    .replace(/[·.…\s]+/gu, ' ')
    .trim()
  return !stripped || stripped.length < 3
}

/** 한글 경계 — JS `\b`는 한글에 신뢰할 수 없음 */
const MEAL_NOT_HOTEL_RE = /^(?:조식|중식|석식|아침|점심|저녁|불포함|기내식)(?:\s|$|\/|·|,)/u

function hasLodgingHotelToken(s: string): boolean {
  // 「호텔식」은 식사 — 숙소 토큰으로 치지 않음
  if (/(Hotel|Resort|리조트|旅館|Ryokan)/i.test(s)) return true
  if (/호텔식/u.test(s)) return false
  return /호텔/u.test(s)
}

function isMealNotHotelLabel(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (MEAL_NOT_HOTEL_RE.test(t)) return true
  if (/^(?:조식|중식|석식|아침|점심|저녁|불포함|기내식)$/u.test(t)) return true
  // 「조식 호텔식」— 식사 슬롯 + 식종
  if (
    /^(?:조식|중식|석식|아침|점심|저녁)\s+/u.test(t) &&
    /(?:호텔식|기내식|현지식|불포함|도시락)/u.test(t) &&
    !hasLodgingHotelToken(t)
  ) {
    return true
  }
  return false
}

function isNonHotelPlaceholder(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim().replace(/^[:：]\s*/, '')
  if (!t) return true
  if (/^-\s*공항/u.test(t)) return true
  // 대표명 아님 — 단어만/출발전 확정 안내
  if (/^(?:호텔|숙소|리조트|호텔\s*투숙|휴식|상세보기|동급)$/u.test(t)) return true
  if (/^동급\s*(?:[（(]\s*준?\s*[3-5]\s*성\s*급?\s*[）)])?$/u.test(t)) return true
  if (/^(?:상세\s*보기\s*)+$/u.test(t)) return true
  // 롯데 등 UI 잔재·성급/투숙만 남은 일차호텔 덩어리
  if (/상세\s*보기/u.test(t) && isGradeOrStayChromeOnly(t)) return true
  if (/호텔\s*투숙/u.test(t) && isGradeOrStayChromeOnly(t)) return true
  if (/준?\s*[3-5]\s*성\s*급?\s*호텔/u.test(t) && isGradeOrStayChromeOnly(t)) return true
  if (/^예정\s*(?:호텔|리조트)/u.test(t)) return true
  if (/\d+\s*일\s*차\s*예정\s*호텔/u.test(t) && /출발\s*전|확정|기내박/u.test(t)) return true
  // 「5성 호텔」만 — 브랜드 없음
  if (/^[준]?\s*[3-5]\s*성\s*(?:급\s*)?호텔$/u.test(t)) return true
  if (isGradeOrStayChromeOnly(t) && /(?:호텔\s*투숙|준?\s*[3-5]\s*성|상세\s*보기|숙박\s*없음)/u.test(t)) {
    return true
  }
  // 「상하이 예정 호텔(동급 가능)」— 도시+예정호텔만 (브랜드명 없음)
  if (
    /^[가-힣A-Za-z]{2,12}\s*예정\s*호텔/u.test(t) &&
    !/(메리어트|노보텔|힐튼|하얏트|쉐라톤|인터컨티넨탈|코트야드|Hotel|Resort|리조트|호텔\s*[A-Za-z])/i.test(t)
  ) {
    return true
  }
  // 확정 안내 문장 (숙소명 아님)
  if (/상세\s*호텔은|숙박\s*예정이며|출발\s*\d+\s*일\s*전.*(?:확정|문자|전화)/u.test(t) && t.length > 20) {
    return true
  }
  // 상품 제목형 덩어리 (호텔명 아님)
  if (/^\[[^\]]{2,40}\]/.test(t) && /(일\b|박\b|#|특식|팁포함)/u.test(t)) return true
  if (/[【】]/.test(t) && /(?:골프|\d+\s*일|\d+\s*박|#)/u.test(t)) return true
  if (/(?:골프|\d+\s*색)/u.test(t) && /\d+\s*일/u.test(t) && t.length > 24) return true
  if (/현재\s*미정|숙박시설은\s*현재|호텔\s*미정|출발\s*\d+\s*일\s*전\s*홈페이지/u.test(t)) return true
  if (/숙소로\s*이동|체크인\s*외/u.test(t) && !hasLodgingHotelToken(t)) return true
  if (/^:?\s*기내\s*박/u.test(t) || /^기내숙박/u.test(t)) return true
  if (/^숙박\s*없음/u.test(t)) return true
  if (/호텔조식|폴스뷰\s*호텔조식/u.test(t) && !/(Hotel|Resort|리조트)/i.test(t)) return true
  return false
}

function looksLikeHotelName(s: string): boolean {
  const t = stripHotelChromeTail(s)
  if (t.length < 2 || t.length > 90) return false
  if (isChromeHotelFragment(t)) return false
  if (KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(t)) return false
  if (COUNT_PLACEHOLDER_RE.test(t)) return false
  if (HOTEL_NOTICE_RE.test(t)) return false
  if (isMealNotHotelLabel(t) && !hasLodgingHotelToken(t)) return false
  if (isNonHotelPlaceholder(t)) return false
  if (DAY_HOTEL_HEADER_RE.test(t) && t.length < 20) return false
  if (hasLodgingHotelToken(t) || /(Inn\b|Lodge|Villa|Wyndham|Mercure|Pullman|Crowne)/i.test(t)) {
    return true
  }
  if (/[A-Za-z]{3,}/.test(t) && !/EX\.|싱글침대|트윈룸|스탠다드/i.test(t)) return true
  return /[가-힣]{2,}/u.test(t) && !/예정\s*호텔|정보\s*보기|호텔소개/u.test(t)
}

function finalizeHotelPick(pick: string): string | null {
  let out = stripHotelChromeTail(pick)
    .replace(/^[:：]\s*/, '')
    .replace(/\s*#.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (isNonHotelPlaceholder(out) || (isMealNotHotelLabel(out) && !hasLodgingHotelToken(out))) {
    return null
  }
  if (!out || CHROME_ONLY_RE.test(out) || KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(out) || HOTEL_NOTICE_RE.test(out)) {
    return null
  }
  // 참좋은여행 축약형 — 영문 lead 절단 금지
  if (/혹은\s*동급\s*\(|출발일\s*1~2일전\s*공지/u.test(out)) {
    return out.length > 72 ? `${out.slice(0, 71).trimEnd()}…` : out
  }
  // 영문 호텔명만 우선 추출 (한글 부연·갤러리 문구 제거)
  const engHotel = out.match(
    /[A-Za-z][A-Za-z0-9 .,&'()\-]{1,70}(?:Hotel|Resort|Inn|Lodge|Villa|Ryokan|Plaza|Palace|Wyndham|Mercure|Pullman)[A-Za-z0-9 .,&'()\-]{0,40}/i,
  )
  if (engHotel) {
    out = engHotel[0]!.replace(/\s+/g, ' ').trim()
  } else {
    // `NAME 클럽 윈담`처럼 영문 고유명 + 한글 병기 → 영문 구간만
    const engLead = out.match(/^([A-Za-z][A-Za-z0-9 .,&'()\-]{3,70})/)
    if (engLead && /[A-Za-z]{4,}/.test(engLead[1]!)) {
      out = engLead[1]!.replace(/\s+/g, ' ').trim()
    }
  }
  if (out.length > 72) {
    const cut = out.slice(0, 72)
    const breakAt = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('·'), cut.lastIndexOf(','))
    out = `${out.slice(0, breakAt > 28 ? breakAt : 72).trimEnd()}…`
  }
  return out || null
}

/** `1일차 예정호텔\nNAME\n호텔소개\n2일차…` → 첫 숙소명 */
function pickFromDayHotelSummaryBlob(src: string): string | null {
  if (!DAY_HOTEL_HEADER_RE.test(src)) return null
  const normalized = src
    .replace(/\r/g, '')
    .replace(/\s*(\d+\s*일\s*차\s*(?:예정)?\s*호텔)/gu, '\n$1')
  const chunks = normalized.split(/(?=\d+\s*일\s*차\s*(?:예정)?\s*호텔)/u)
  for (const chunk of chunks) {
    const body = chunk.replace(/^\d+\s*일\s*차\s*(?:예정)?\s*호텔\s*/u, '').trim()
    if (!body) continue
    for (const line of body.split(/\n+/)) {
      const t = stripHotelChromeTail(line)
      if (!t || isChromeHotelFragment(t) || HOTEL_NOTICE_RE.test(t)) continue
      if (KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(t)) continue
      if (t.includes('/')) {
        const viaSlash = scrubPublicHotelDisplayLineCore(t, { allowDayBlob: false })
        if (viaSlash) return viaSlash
      }
      if (looksLikeHotelName(t)) {
        const fin = finalizeHotelPick(t)
        if (fin) return fin
      }
    }
  }
  return null
}

function scrubPublicHotelDisplayLineCore(
  srcIn: string,
  opts: { allowDayBlob: boolean },
): string | null {
  const src = srcIn.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  if (!src) return null
  if (KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(src)) return null
  if (CHROME_ONLY_RE.test(src)) return null
  if (HOTEL_NOTICE_RE.test(src)) return null
  // 식사 문구가 호텔 필드로 들어온 경우
  if (isMealNotHotelLabel(src) && !hasLodgingHotelToken(src)) {
    return null
  }
  if (isNonHotelPlaceholder(src)) return null
  if (COUNT_PLACEHOLDER_RE.test(src) && !looksLikeHotelName(src.replace(COUNT_PLACEHOLDER_RE, '').trim())) {
    return null
  }

  if (opts.allowDayBlob && DAY_HOTEL_HEADER_RE.test(srcIn)) {
    const fromBlob = pickFromDayHotelSummaryBlob(srcIn)
    if (fromBlob) return fromBlob
  }
  // 개행이 이미 공백으로 합쳐진 일차 요약
  if (opts.allowDayBlob && DAY_HOTEL_HEADER_RE.test(src)) {
    const fromBlob = pickFromDayHotelSummaryBlob(src)
    if (fromBlob) return fromBlob
  }

  const parts = src
    .split(/\s*\/\s*/)
    .map((p) => stripHotelChromeTail(p))
    .filter((p) => p && !isChromeHotelFragment(p) && !KR_DEPARTURE_SCHEDULED_HOTEL_RE.test(p) && !HOTEL_NOTICE_RE.test(p))

  if (parts.length === 0) return null

  const named = parts.find((p) => looksLikeHotelName(p))
  if (!named) return null
  return finalizeHotelPick(named.trim())
}

/**
 * 공개 호텔 한 줄. 쓰레기·국내출발 허브 placeholder·갤러리 나열이면 null 또는 대표 숙소명 1개.
 */
export function scrubPublicHotelDisplayLine(raw: string | null | undefined): string | null {
  const rawStr = String(raw ?? '')
  if (!rawStr.trim()) return null
  return scrubPublicHotelDisplayLineCore(rawStr, { allowDayBlob: true })
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
