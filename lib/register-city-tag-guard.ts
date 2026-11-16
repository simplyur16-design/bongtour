/**
 * 등록 도시 태그 — 추가만 거른다. 이미 있는 태그를 지우지 않는다.
 * 근거는 일차 제목·장소(route)이다. 서술·비유·거리명·경유/공항·안내문은 근거가 아니다.
 *
 * nodeKey가 클러스터 leaf(예: sichuan)이면 chengdu·jiuzhaigou·chongqing은
 * 본문 매칭이 아니라 등록된 대표 노드의 구성 도시라 유지한다.
 * (pkg-hn-0202·pkg-hn-0215 대표 nodeKey = sichuan)
 *
 * REGRESSION-FREEZE[register-city-tag-visit-guard]: 방문 근거 없는 도시 추가는 막음 — manifest
 */

const NOTICE_OR_LAYOVER_LINE =
  /총영사관|영사관|유의사항|긴급\s*연락|안내\s*사항|경유|환승|공항/

/** 비유·고유명사·거리명. 매칭 전에 지운다. */
const BLOCKED_CITY_SPAN =
  /(?:작은|미니)\s*[가-힣]{2,}|[가-힣]{2,}\s*(?:관저|묘소|묘|동상|사당)|남경로/g

export function sanitizeCityVisitText(text: string | null | undefined): string {
  const raw = String(text ?? '')
  if (!raw.trim()) return ''
  const lines = raw.split(/\n+/)
  const kept: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (NOTICE_OR_LAYOVER_LINE.test(t)) continue
    kept.push(t.replace(BLOCKED_CITY_SPAN, ' '))
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
    const dayParts = [row.title, row.routeText, row.description]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
    if (dayParts.length) parts.push(dayParts.join(' '))
  }
  const joined = sanitizeCityVisitText(parts.join('\n')).trim()
  if (!joined) return null
  return joined.length > 6000 ? joined.slice(0, 6000) : joined
}

/**
 * haystack으로 추가하려는 도시만 방문 근거를 본다.
 * geo.cityKey·클러스터 대표 노드에서 온 키는 그대로 둔다.
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
