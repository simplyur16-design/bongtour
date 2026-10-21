/**
 * 참좋은여행 — 호텔/관광지 탭·[호텔설명] → 비교·공개용 한 줄.
 * REGRESSION-FREEZE[verygoodtour-hotel-info-display]: HotelInfoList·호텔설명 축약 — manifest
 */

const VERYGOODTOUR_BASE = 'https://www.verygoodtour.com'

export type VerygoodtourHotelInfoParse = {
  /** 예정 호텔명 (일차별 중복 제거) */
  names: string[]
  /** 등급 힌트: 준특급·특급·일급·N성급 */
  grade: string | null
  /** 출발전 안내(미정) 여부 */
  undecidedUntilDepart: boolean
  /** [호텔설명] 원문(평문) */
  hotelExplainRaw: string | null
}

/** PackageDetail HTML 내 addHotelInfo → [호텔설명] 본문 */
export function extractVerygoodtourAddHotelInfoText(detailHtml: string | null | undefined): string | null {
  const html = String(detailHtml ?? '')
  const m = html.match(/addHotelInfo\s*=\s*'((?:\\'|[^'])*)'/)
  if (!m?.[1]) return null
  const plain = m[1]
    .replace(/\\'/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain || null
}

export function extractVerygoodtourPriceSeqFromDetailHtml(detailHtml: string | null | undefined): string | null {
  const html = String(detailHtml ?? '')
  const fromPost = html.match(
    /HotelInfoList["']\s*,\s*\{\s*["']ProCode["']\s*:\s*["'][^"']+["']\s*,\s*["']PriceSeq["']\s*:\s*["'](\d+)["']/,
  )
  if (fromPost?.[1]) return fromPost[1]
  const fromShow = html.match(/ShowPlaceInfoList\?ProCode=[^&]+&PriceSeq=(\d+)/i)
  if (fromShow?.[1]) return fromShow[1]
  const fromUrl = html.match(/PriceSeq=(\d+)/i)
  return fromUrl?.[1] ?? null
}

function extractGradeHint(...blobs: Array<string | null | undefined>): string | null {
  const t = blobs.filter(Boolean).join('\n')
  const m = t.match(/준\s*특급|특급(?:\s*호텔)?|일급(?:\s*호텔)?|준\s*[3-5]\s*성\s*급?|[3-5]\s*성\s*급/u)
  if (!m) return null
  const g = m[0]!.replace(/\s+/g, '')
  if (/^특급호텔$/u.test(g)) return '특급'
  if (/^일급호텔$/u.test(g)) return '일급'
  if (/성$/.test(g)) return `${g}급`
  return g.replace(/호텔$/u, '') || g
}

/** HotelInfoList HTML → 호텔명·미정·등급 */
export function parseVerygoodtourHotelInfoListHtml(
  hotelListHtml: string | null | undefined,
  opts?: { hotelExplainRaw?: string | null },
): VerygoodtourHotelInfoParse {
  const html = String(hotelListHtml ?? '')
  const names: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<p class="name">[\s\S]*?<b>([\s\S]*?)<\/b>/gi)) {
    const name = m[1]!
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!name || name.length < 2 || name.length > 80) continue
    if (/호텔등급|안내드립니다|미정|동급/u.test(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }

  const plain = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const undecidedUntilDepart =
    names.length === 0 &&
    /출발\s*1\s*[~～\-]\s*2\s*일|호텔명\s*은\s*미정|담당자를\s*통해\s*안내|홈페이지\s*또는\s*유선/u.test(
      `${plain}\n${opts?.hotelExplainRaw ?? ''}`,
    )

  const grade = extractGradeHint(opts?.hotelExplainRaw, plain, names.join(' '))

  return {
    names,
    grade,
    undecidedUntilDepart,
    hotelExplainRaw: opts?.hotelExplainRaw?.trim() || null,
  }
}

/**
 * 비교·공개 한 줄.
 * - 예정호텔명 있으면: `{이름} 혹은 동급(추후안내)`
 * - 미정+등급: `{준특급} 출발일 1~2일전 공지`
 * - 미정만: `출발일 1~2일전 공지`
 */
export function formatVerygoodtourHotelCompareLabel(parsed: VerygoodtourHotelInfoParse): string | null {
  if (parsed.names.length > 0) {
    return `${parsed.names[0]} 혹은 동급(추후안내)`
  }
  if (parsed.undecidedUntilDepart) {
    if (parsed.grade) return `${parsed.grade} 출발일 1~2일전 공지`
    return '출발일 1~2일전 공지'
  }
  // [호텔설명]만 있고 목록이 비었을 때 — 설명 문구에서 축약
  const explain = parsed.hotelExplainRaw || ''
  if (explain) {
    const grade = parsed.grade || extractGradeHint(explain)
    if (/미정|출발\s*1|안내\s*드립/u.test(explain)) {
      return grade ? `${grade} 출발일 1~2일전 공지` : '출발일 1~2일전 공지'
    }
  }
  return null
}

/** hotelSummaryRaw·제목·호텔설명 평문만으로도 축약 (오프라인) */
export function formatVerygoodtourHotelLabelFromTextBlobs(
  ...blobs: Array<string | null | undefined>
): string | null {
  const joined = blobs.filter((b) => String(b ?? '').trim()).join('\n')
  if (!joined.trim()) return null
  // 이미 축약된 값이면 유지
  if (/혹은\s*동급\s*\(\s*추후안내\s*\)|출발일\s*1~2일전\s*공지/u.test(joined) && joined.length <= 60) {
    return joined.replace(/\s+/g, ' ').trim()
  }
  const explain =
    joined.match(/\[호텔설명\]\s*([\s\S]{0,400})/)?.[1]?.trim() ||
    (/준특급|호텔명\s*은\s*미정|출발\s*1\s*[~～\-]\s*2\s*일/u.test(joined) ? joined : null)
  const parsed = parseVerygoodtourHotelInfoListHtml(joined.includes('<') ? joined : '', {
    hotelExplainRaw: explain,
  })
  // 평문에 `<b>이름</b>` 없이 호텔명 나열이 있으면 첫 줄 후보 (도시+예정호텔 placeholder 제외)
  if (parsed.names.length === 0) {
    const line = joined
      .split(/\n/)
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length >= 3 &&
          l.length <= 48 &&
          /(Hotel|Resort|메리어트|노보텔|힐튼|하얏트|쉐라톤|도미인|Hyatt|호텔)/i.test(l) &&
          !/호텔설명|예정\s*호텔|조식|불포함|등급안내|미정|안내\s*드립|동급\s*가능/u.test(l),
      )
    if (line) parsed.names.push(line.replace(/^[-·▪\s]+/, ''))
  }
  if (!parsed.undecidedUntilDepart && /미정|출발\s*1\s*[~～\-]\s*2\s*일|안내\s*드립/u.test(joined)) {
    parsed.undecidedUntilDepart = parsed.names.length === 0
  }
  if (!parsed.grade) parsed.grade = extractGradeHint(joined)
  return formatVerygoodtourHotelCompareLabel(parsed)
}

export async function fetchVerygoodtourHotelInfoListHtml(args: {
  originUrl: string
  proCode: string
  priceSeq: string
}): Promise<string | null> {
  const res = await fetch(`${VERYGOODTOUR_BASE.replace(/\/$/, '')}/Product/HotelInfoList`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'accept-language': 'ko-KR',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: args.originUrl,
      'x-requested-with': 'XMLHttpRequest',
      origin: VERYGOODTOUR_BASE,
    },
    body: new URLSearchParams({
      ProCode: args.proCode,
      PriceSeq: args.priceSeq,
    }).toString(),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null)
  if (!res?.ok) return null
  return res.text()
}
