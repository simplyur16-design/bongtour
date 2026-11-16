/**
 * 등록 도시 태그 — 추가만 거른다. 이미 있는 태그를 지우지 않는다.
 * 근거는 일차 제목·장소(route)이다. 서술·비유·거리명·경유/공항·안내문은 근거가 아니다.
 *
 * nodeKey가 클러스터 leaf(예: sichuan)여도 구성 도시는 그 도시 표기가 방문 근거에 있을 때만 추가한다.
 * 노드 공용 토큰은 구성 도시 전부에 붙이지 않는다.
 * (pkg-hn-0202·pkg-hn-0215 대표 nodeKey = sichuan, cityKey는 비어 있음)
 *
 * REGRESSION-FREEZE[register-city-tag-visit-guard]: 방문 근거 없는 도시 추가는 막음 — manifest
 */

/** 안내문 줄은 통째로 뺀다. */
const NOTICE_LINE = /총영사관|영사관|유의사항|긴급\s*연락|안내\s*사항/

/**
 * 경유·환승·공항·항공사명은 그 토막만 지운다(줄 전체를 버리면 같은 줄의 실제 방문지까지 사라짐).
 * 예: 「인천국제공항 출발 / 프라하 향발」→ 프라하 유지, 「바스토우 경유 ◆ · 라스베이거스」→ 라스베이거스 유지.
 */
const LAYOVER_SPAN =
  /[가-힣A-Za-z]+\s*(?:국제\s*)?공항|[가-힣A-Za-z]+(?:을|를)?\s*경유[가-힣]*|[가-힣A-Za-z]+(?:에서)?\s*환승[가-힣]*|[가-힣A-Za-z]*항공/g

/** 비유·고유명사·거리명. 매칭 전에 지운다. */
const BLOCKED_CITY_SPAN =
  /(?:작은|미니)\s*[가-힣]{2,}|[가-힣]{2,}\s*(?:관저|생가|박물관|기념관|묘소|묘|동상|사당)|남경(?:동|서)?로/g

/**
 * 상해 일정 속 「남경」은 남경로(南京路) 약칭 — 「상해 - 남경 - 외탄」「예원 · 남경」.
 * 난징(南京) 실제 방문 상품은 일정에 「난징」을 쓴다(남경 4일·남경/장가계 등). 난징 표기가 없을 때만 지운다.
 */
const SHANGHAI_CONTEXT = /상해|상하이|외탄|예원/
const NANJING_EXPLICIT = /난징|nanjing/i
const NANJING_ROAD_SHORT = /남경(?=$|[\s·\-–,/]|과|와|을|를)/g

export function sanitizeCityVisitText(text: string | null | undefined): string {
  let raw = String(text ?? '')
  if (!raw.trim()) return ''
  if (SHANGHAI_CONTEXT.test(raw) && !NANJING_EXPLICIT.test(raw)) raw = raw.replace(NANJING_ROAD_SHORT, ' ')
  const lines = raw.split(/\n+/)
  const kept: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (NOTICE_LINE.test(t)) continue
    kept.push(t.replace(LAYOVER_SPAN, ' ').replace(BLOCKED_CITY_SPAN, ' '))
  }
  return kept.join('\n')
}

export type RegisterCityScheduleRow = {
  title?: string | null
  routeText?: string | null
  description?: string | null
}

/**
 * 도시 태그 근거 — 일차 제목·장소·본문.
 * 본문은 sanitize에서 비유·거리명·관저·경유/공항·안내문만 뺀다.
 */
export function buildRegisterCityVisitHaystackFromSchedule(
  rows: readonly RegisterCityScheduleRow[],
): string | null {
  const parts: string[] = []
  for (const row of rows) {
    // 필드·문장 단위 줄 — 안내문 줄 제거가 같은 일차의 다른 방문지를 지우지 않게
    for (const field of [row.title, row.routeText, row.description]) {
      for (const line of String(field ?? '').split(/\n+|(?<=[.!?。])\s+/)) {
        if (line.trim()) parts.push(line.trim())
      }
    }
  }
  const joined = sanitizeCityVisitText(parts.join('\n')).trim()
  if (!joined) return null
  return joined.length > 6000 ? joined.slice(0, 6000) : joined
}

/**
 * haystack으로 추가하려는 도시만 방문 근거를 본다.
 * geo.cityKey는 그대로 두고, 클러스터 구성 도시는 그 도시 표기가 있을 때만 넣는다.
 */
export function haystackCityKeyHasVisitEvidence(terms: readonly string[], visitText: string): boolean {
  const visit = sanitizeCityVisitText(visitText)
  if (!visit.trim()) return false
  for (const term of terms) {
    const t = term.trim()
    if (t.length < 2) continue
    if (/^[a-z]{2}$/i.test(t)) continue
    if (termAppearsAsVisit(t, visit)) return true
  }
  return false
}

function termAppearsAsVisit(term: string, visit: string): boolean {
  const tl = term.trim().toLowerCase()
  const low = visit.toLowerCase()
  if (!tl || !low) return false
  if (/[\uac00-\ud7a3]/.test(tl)) {
    const re = new RegExp(
      `(^|[^\\uac00-\\ud7a3])${escapeRegExp(tl)}([^\\uac00-\\ud7a3]|$)`,
    )
    return re.test(low)
  }
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(tl)}([^a-z0-9]|$)`, 'i')
  return re.test(low)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
