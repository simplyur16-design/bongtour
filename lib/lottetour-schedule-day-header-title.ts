/**
 * 롯데관광(lottetour) 전용: 일차 헤더 `title`(장소·동선 요약)만 생성.
 * description / 식사·숙소 / imageKeyword는 변경하지 않는다.
 */

export type LottetourHeaderTitleInput = {
  day: number
  /** LLM·추출 기존 title (참고만) */
  title: string
  /** 동선·관광 근거 텍스트 (읽기 전용) */
  description: string
  dateText?: string | null
}

const DAY_N_TRAVEL = /^day\s*\d+\s*travel$/i

const SENTENCE_TAIL = /(?:습니다|읍니다|합니다|예정입니다|입니다|했습니다|갑니다)\s*\.?\s*$/u

const MEAL_HOTEL = /호텔|리조트|조식|중식|석식|식사\s*[:：]|예정\s*호텔|쇼핑|면세|공항\s*픽업/

const BAN_TITLE = /동유럽\s*\d+\s*개국|유럽\s*\d+\s*개국|아시아\s*\d+\s*개국/

/** 본문 등장 순서대로 스캔(긴 지명 우선) */
const Lottetour_PLACE_NAMES: string[] = `체스키크룸로프 잘츠부르크 브로츠와프 부다페스트 할슈타트 슈트루브 그린델발트 인터라켄 취리히 제네바 루체른 베네치아 피렌체 로마 밀라노 바티칸 파리 니스 마르세유 런던 맨체스터 에든버러 더블린 바르셀로나 마드리드 세비야 리스본 포르투 베를린 뮌헨 프랑크푸르트 쾰른 드레스덴 함부르크 비엔나 프라하 크라쿠프 바르샤바 부카레스트 소피아 자그레브 류블랴나 베오그라드 스코페 티라나 두브로브니크 스플리트 자다르 암스테르담 브뤼셀 룩셈부르크 코펜하겐 스톡홀름 오슬로 헬싱키 레이캬비크 모스크바 상트페테르부르크 트로무소 올로모우츠 인천 김포 서울 부산 대구 제주 울산 광주 여수 강릉 속초 동해 포항 가고시마 오키나와 나하 이시가키 미야코지마 도쿄 요코하마 가마쿠라 하코네 닛코 후지 오사카 교토 고베 나라 삿포로 오타루 하코다테 아오모리 센다이 나고야 다카야마 시라카와고 가나자와 후쿠오카 유후인 벳부 구마모토 나가사키 상해 북경 서안 청두 충칭 광저우 선전 항저우 소주 남경 청도 연길 장춘 하얼빈 다롄 천진 홍콩 마카오 타이페이 타오위안 화련 타이중 가오슝 지우펀 켄팅 방콕 치앙마이 치앙라이 파타야 후아힌 끄라비 푸켓 코사무이 다낭 호이안 하노이 하롱 호치민 달랏 나짱 푸꾸옥 발리 자카르타 쿠알라룸푸르 페낭 랑카위 코타키나발루 싱가포르 시드니 멜버른 골드코스트 케언즈 퍼스 뉴욕 워싱턴 시카고 밴쿠버 토론토 괌 사이판 호놀룰루 하와이`
  .split(/\s+/)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)

function compactWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function extractPlacesInOrder(hay: string): string[] {
  const h = compactWs(hay)
  if (!h) return []
  const hits: Array<{ idx: number; name: string }> = []
  for (let i = 0; i < h.length; i++) {
    for (const name of Lottetour_PLACE_NAMES) {
      if (h.startsWith(name, i)) {
        hits.push({ idx: i, name })
        i += name.length - 1
        break
      }
    }
  }
  hits.sort((a, b) => a.idx - b.idx)
  const seen = new Set<string>()
  const out: string[] = []
  for (const { name } of hits) {
    if (seen.has(name)) continue
    if (MEAL_HOTEL.test(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function formatRoute(places: string[], hay: string): string {
  const h = hay
  let seq = [...places]
  if (seq.length > 4) seq = seq.slice(0, 4)

  if (seq.length >= 2) return seq.join(' - ').slice(0, 120)
  if (seq.length === 1) {
    const only = seq[0]!
    if (only === '인천' && /도착|귀국|입국/u.test(h)) return '인천 도착'
    return only
  }

  const firstSeg = h.split(/[,，]/).map((x) => x.trim()).find((frag) => {
    if (frag.length < 2 || frag.length > 36) return false
    if (MEAL_HOTEL.test(frag)) return false
    if (/^\d{4}[./]/.test(frag)) return false
    if (/출발|도착/.test(frag) && frag.length > 24) return false
    return /[가-힣]/.test(frag)
  })
  if (firstSeg) return firstSeg.replace(/^[\s\-–:]+/, '').slice(0, 60)

  return ''
}

/** LLM/추출 title을 그대로 둘지(문장형·날짜만·placeholder 아님) */
export function shouldReplaceLottetourScheduleDayTitle(title: string, description: string): boolean {
  const t = title.replace(/\s+/g, ' ').trim()
  if (!t || t === '-' || t === '—' || t === '–') return true
  if (DAY_N_TRAVEL.test(t)) return true
  if (BAN_TITLE.test(t)) return true
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(t) && t.length < 18) return true
  if (t.length > 72) return true
  if (SENTENCE_TAIL.test(t) && t.length > 24) return true
  const d0 = description.replace(/\s+/g, ' ').trim()
  if (d0.length >= 30 && d0.startsWith(t) && t.length >= 40) return true
  if (/^[\d\s\-–—·일차제]+$/u.test(t)) return true
  return false
}

/**
 * 장소/동선 요약형 일차 제목. description은 읽기만 하고 수정하지 않는다.
 */
export function deriveLottetourScheduleDayHeaderTitle(input: LottetourHeaderTitleInput): string {
  const hay = compactWs(`${input.title}\n${input.description}`)
  if (!hay) return ''

  if (BAN_TITLE.test(input.title)) {
    /* 제목이 포괄 문구뿐이면 본문에서만 추출 */
  }

  const places = extractPlacesInOrder(hay)
  const route = formatRoute(places, hay)
  if (route) return route

  const incheonOut = /인천\s*\(?\s*ICN\s*\)?\s*출발/u.test(hay)
  const firstForeign = places.find((p) => p !== '인천' && p !== '김포' && p !== '서울')
  if (input.day === 1 && incheonOut && firstForeign) return `인천 - ${firstForeign}`.slice(0, 120)

  return ''
}
