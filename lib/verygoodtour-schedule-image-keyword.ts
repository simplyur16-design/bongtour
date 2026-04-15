/**
 * 참좋은여행(verygoodtour) 전용: 일차 `imageKeyword`를 시각 검색에 쓸 수 있는
 * 「장소 / 배경 요소 / 시점」 형태로 정리한다. 도시명만 하이픈으로 잇는 문자열은 약한 값으로 본다.
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

/** `verygoodtour-schedule-description-polish`와 동일 우선순위·길이 기준(도시 체인 탐지용) */
const KNOWN_PLACE_TOKENS: string[] = `체스키크룸로프 잘츠부르크 브로츠와프 부다페스트 할슈타트 인터라켄 취리히 제네바 루체른 베네치아 피렌체 로마 밀라노 바티칸 파리 니스 마르세유 런던 에든버러 바르셀로나 마드리드 리스본 베를린 뮌헌 비엔나 프라하 크라쿠프 융프라우 인터라켄 그린델발트 인천 김포 서울 부산 제주 도쿄 요코하마 오사카 교토 삿포로 나고야 후쿠오카 가나자와 홍콩 마카오 타이페이 방콕 치앙마이 파타야 푸켓 다낭 하노이 호치민 발리 싱가포르 시드니 멜버른 뉴욕 밴쿠버 토론토 괌 사이판 호놀룰루 상해 북경 광저우 연길 장춘 빌뉴스 트라카이 리가 타린 골든록 헬싱키 스톡홀름 오슬로 코펜하겐`
  .split(/\s+/)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)

const NOISE_LINE =
  /항공|OZ\d|KE\d|LJ\d|TW\d|편으로|공항|터미널|탑승\s*수속|체크인|출국|입국|귀국|인천국제|ICN|GMP|미팅|집결|셔틀|환승|버스\s*이동|열차\s*이동|페리|드라이브|Drive|호텔|투숙|예정\s*호텔|리조트|콘도|조식|중식|석식|면세|쇼핑\s*센터|자유\s*시간|자유일정|자유\s*활동|선택\s*관광/i

const SIGHT_HINT = /관광|방문|입장|체험|감상|둘러보|전망|조망|산책|유람|크루즈|하이킹/i

const LANDMARK_HINT =
  /성|궁|전|사원|사찰|대성당|교회|탑|다리|광장|해변|호수|언덕|박물관|미술관|유적|마을|구시가지|국립공원|폭포|성당|수도원|성채|요새|전망대|기념비|유람선|케이블카/i

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function stripForScan(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function isDayNTravelPlaceholder(s: string): boolean {
  return DAY_N_TRAVEL_RE.test(s.trim())
}

/** 하이픈·중점으로 잇된 토큰이 전부 알려진 도시명뿐이면 약한 키워드 */
function isLatinHyphenPlaceChain(s: string): boolean {
  const t = s.trim()
  if (!/[a-z]{2,}-[a-z]{2,}/i.test(t)) return false
  if (/[가-힣]/.test(t)) return false
  const parts = t.split('-').map((x) => x.trim()).filter(Boolean)
  if (parts.length < 2) return false
  for (const p of parts) {
    if (!/^[A-Za-z]{2,28}$/.test(p)) return false
  }
  return !SIGHT_HINT.test(t) && !LANDMARK_HINT.test(t)
}

function isCityHyphenChainOnly(s: string): boolean {
  const t = s.replace(/\s*·\s*/g, '-').replace(/\s*-\s*/g, '-').trim()
  if (!t || t.length < 3) return false
  if (!/[가-힣]/.test(t)) return false
  const parts = t
    .split('-')
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length < 2) return false
  for (const p of parts) {
    const hit = KNOWN_PLACE_TOKENS.find((k) => k === p)
    if (!hit) return false
  }
  return !SIGHT_HINT.test(t) && !LANDMARK_HINT.test(t)
}

function isWeakImageKeyword(s: string): boolean {
  const t = s.trim()
  if (!t || isDayNTravelPlaceholder(t)) return true
  if (t.length > 140) return true
  if (/\n/.test(t)) return true
  if (isCityHyphenChainOnly(t)) return true
  if (isLatinHyphenPlaceChain(t)) return true
  if (/^\s*\d+\s*일차/i.test(t)) return true
  if (/호텔|예정\s*호텔|투숙|조식|중식|석식|편으로|OZ\d|KE\d/i.test(t) && !LANDMARK_HINT.test(t)) return true
  return false
}

function scoreLineForLandmark(line: string): number {
  const t = line.trim()
  if (!t || t.length > 220) return -50
  if (/^식사\s*$|^호텔\s*$|^▶\s*호텔|^▶\s*식사/i.test(t)) return -80
  if (/지도보기|내용보기|내용\s*전체\s*열기/i.test(t)) return -80
  if (/항공|OZ\d|KE\d|편으로|탑승\s*수속|체크인|터미널|GMP|ICN/i.test(t)) return -40
  if (/호텔|투숙|예정\s*호텔|리조트|콘도/i.test(t) && !/궁|성채/i.test(t)) return -15
  if (/자유\s*시간|자유일정|자유\s*활동/i.test(t)) return -10
  let s = 0
  if (SIGHT_HINT.test(t)) s += 12
  if (LANDMARK_HINT.test(t)) s += 14
  if (/트라카이|성당|구시가지|올드\s*타운|old\s*town/i.test(t)) s += 6
  if (/이동|출발|도착|향해/.test(t)) s += 2
  if (t.length >= 8 && t.length <= 120) s += 2
  return s
}

function bestLineFromBlob(blob: string): string | null {
  const lines = stripForScan(blob)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let best = ''
  let bestScore = 0
  for (const line of lines) {
    const sc = scoreLineForLandmark(line)
    if (sc > bestScore) {
      bestScore = sc
      best = line
    }
  }
  return bestScore >= 8 ? best : null
}

/** 「장소」 후보: 관광 직전 명사구 또는 점수 최고 줄에서 첫 유의미 토큰 */
function extractPlaceClause(line: string): string | null {
  const m1 = line.match(
    /([가-힣][가-힣0-9·\s]{1,26}?)\s*(?:관광|방문|입장|체험|감상|둘러보기|둘러봄|전망|조망)(?=\s|$|[.。!])/u
  )
  if (m1?.[1]) {
    const p = squash(m1[1]).replace(/(?:에서|으로|까지|이후|후)\s*$/u, '').trim()
    if (p.length >= 2 && p.length <= 40) return p
  }
  const m2 = line.match(/▶\s*([^\n]{2,44})/u)
  if (m2?.[1]) {
    const p = squash(m2[1].split(/[／/|]/)[0] ?? '').trim()
    if (p.length >= 2 && p.length <= 44 && !/^호텔|^식사/i.test(p)) return p
  }
  const m3 = line.match(/(?:^|[-•])\s*([가-힣][가-힣0-9\s]{1,22})\s*(?:도착|출발|이동|에서)/u)
  if (m3?.[1]) {
    const p = squash(m3[1]).trim()
    if (p.length >= 2 && p.length <= 30) return p
  }
  return null
}

function midSceneSnippet(line: string, place: string): string {
  const idx = line.indexOf(place)
  if (idx < 0) return ''
  let tail = line.slice(idx + place.length).replace(/^[\s,，·.]+/, '')
  const cut = tail.match(/^(.{1,36}?)(?=[.。!]|$)/u)
  tail = (cut ? cut[1] : tail.slice(0, 36)).trim()
  tail = tail.replace(/^(?:에서|으로|까지|후|및|와|과)\s*/u, '').trim()
  if (!tail || NOISE_LINE.test(tail)) return ''
  if (tail.length > 32) tail = tail.slice(0, 32).trim()
  return tail
}

function pickViewpointToken(line: string, isLastDay: boolean): string {
  if (/야경|야간|밤\s*경관|일출|노을|일몰/.test(line)) return '야간·저조도 시점'
  if (/전망|조망|전경|파노라마|원경/.test(line)) return '원경 시점'
  if (/항공|공항|귀국|입국|터미널|인천/.test(line) && isLastDay) return '터미널 전면 시점'
  if (/유람선|크루즈|페리|강변|해변|호수/.test(line)) return '수면·안개 낀 원경'
  if (/골목|거리|광장|구시가지|올드타운|Old\s*Town/i.test(line)) return '눈높이 거리 시점'
  return '눈높이 시점'
}

function buildTripletFromLine(line: string, isLastDay: boolean): string | null {
  const place = extractPlaceClause(line)
  if (!place) return null
  const mid = midSceneSnippet(line, place)
  const vp = pickViewpointToken(line, isLastDay)
  const GENERIC_MID = /^(관광|방문|입장|체험|감상)$/u
  const movementMid = mid && /이동|출발|도착|향해|경유|편으로|관광\s*후/.test(mid)
  const midUse =
    mid && !GENERIC_MID.test(mid) && !movementMid && !NOISE_LINE.test(mid) && mid.length >= 2
      ? mid.replace(/합니다|됩니다|입니다/g, '').trim()
      : LANDMARK_HINT.test(place)
        ? '대표 전각·외관 실루엣'
        : '대표 경관 요소'
  const a = place.slice(0, 36)
  const b = midUse.slice(0, 40)
  return squash(`${a} / ${b} / ${vp}`)
}

function extractLatinLandmark(hay: string): string | null {
  const m = hay.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\b/)
  if (!m?.[1]) return null
  const w = m[1].trim()
  if (/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Hotel|Breakfast|Lunch|Dinner/i.test(w))
    return null
  if (w.length < 4 || w.length > 48) return null
  return `${w} / facade and surroundings / eye-level street view`
}

function cityChainLastResort(blob: string, description: string): string | null {
  const hay = `${blob}\n${description}`
  const hits: string[] = []
  const h = hay.replace(/\s+/g, ' ')
  for (let i = 0; i < h.length; i++) {
    for (const name of KNOWN_PLACE_TOKENS) {
      if (h.startsWith(name, i)) {
        hits.push(name)
        i += name.length - 1
        break
      }
    }
  }
  const uniq = [...new Set(hits)].filter((x) => x !== '인천' && x !== '김포')
  if (uniq.length === 0) return null
  if (uniq.length === 1) {
    const only = uniq[0]!
    return squash(`${only} / 시가지 스카이라인 / 눈높이 시점`)
  }
  return squash(`${uniq.slice(0, 3).join('·')} / 이동 구간 도시 전경 / 원경 시점`)
}

function resolveVerygoodImageKeyword(input: {
  current: string
  description: string
  title: string
  rawDayBody: string
  isLastDay: boolean
  day: number
}): string {
  const cur = input.current.trim()
  if (cur && !isWeakImageKeyword(cur)) return cur.slice(0, 180)

  const blob = `${input.rawDayBody}\n${input.description}\n${input.title}`
  const line = bestLineFromBlob(blob) ?? bestLineFromBlob(input.description)
  if (line) {
    const triplet = buildTripletFromLine(line, input.isLastDay)
    if (triplet) return triplet.slice(0, 180)
  }
  const lat = extractLatinLandmark(blob)
  if (lat) return lat.slice(0, 180)

  const thinDay =
    /(?:귀국|출국|공항|기내|항공일|이동\s*일)/u.test(blob) &&
    !SIGHT_HINT.test(blob) &&
    !LANDMARK_HINT.test(blob)
  if (thinDay) {
    const ap = blob.match(/(인천국제공항|김포국제공항|인천\s*공항|김포\s*공항)/u)?.[1]?.trim()
    if (ap && ap.length <= 28)
      return squash(`${ap} / 활주로·여객동선 / 터미널 전면 시점`).slice(0, 180)
  }

  const last = cityChainLastResort(input.rawDayBody, input.description)
  if (last) return last.slice(0, 180)

  if (cur && !isDayNTravelPlaceholder(cur) && cur.length <= 180) return cur
  const stub = squash(`${input.description}\n${input.title}`).slice(0, 40)
  if (stub.length >= 6 && !NOISE_LINE.test(stub))
    return squash(`${stub} / 일정 하이라이트 / 눈높이 시점`).slice(0, 180)
  return squash(`${input.day}일차 일정 / 여행 동선 / 눈높이 시점`).slice(0, 180)
}

/**
 * 일차 설명·제목 정리 이후 호출한다. `detRows`는 `extractVerygoodScheduleRowsFromPasteBody`의 원문 블록(description)을 담은 행.
 */
export function polishVerygoodRegisterScheduleImageKeywords(
  schedule: RegisterScheduleDay[],
  detRows: RegisterScheduleDay[]
): RegisterScheduleDay[] {
  if (!schedule?.length) return schedule
  const detByDay = new Map<number, RegisterScheduleDay>()
  for (const r of detRows) {
    const d = Number(r.day) || 0
    if (d > 0) detByDay.set(d, r)
  }
  const maxDay = Math.max(...schedule.map((s) => Number(s.day) || 0))
  return schedule.map((row) => {
    const day = Number(row.day) || 0
    const isLastDay = maxDay >= 1 && day === maxDay
    const det = detByDay.get(day)
    const rawDayBody = String(det?.description ?? '')
    const kw = resolveVerygoodImageKeyword({
      current: String(row.imageKeyword ?? '').trim(),
      description: String(row.description ?? '').trim(),
      title: String(row.title ?? '').trim(),
      rawDayBody,
      isLastDay,
      day,
    })
    return { ...row, imageKeyword: kw }
  })
}
