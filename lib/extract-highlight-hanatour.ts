/**
 * 하나투어 전용 — 「📌 상품 핵심 포인트」 구간·prodInfo bnft 상품 판매 포인트.
 * 타 공급사와 공유하지 않음.
 *
 * REGRESSION-FREEZE[hanatour-register-highlight-prodinfo]: formatHanatourHighlightPointsFromProdInfo — manifest
 */
const MAX_HIGHLIGHT = 8000

function coerceString(raw: string | unknown): string {
  if (typeof raw === 'string') return raw
  if (raw == null) return ''
  return String(raw)
}

function breakHtmlLines(html: string): string {
  return html
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)\s*>/gi, '\n')
}

function stripTags(html: string): string {
  const noBlock = html.replace(/<script[\s\S]*?<\/script>/gi, '\n').replace(/<style[\s\S]*?<\/style>/gi, '\n')
  return noBlock.replace(/<[^>]+>/g, ' ')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

/** 하나투어 라인 필터 — 패키지 등급·앵커만 있는 줄 제외 */
function keepHanatourPointLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^하나팩/i.test(t)) return false
  if (/세이브\b/i.test(t) && /특가|등급|패키지/i.test(t)) return false
  if (/^패키지\s*등급/i.test(t)) return false
  if (/^#\s*point\d+/i.test(t)) return false
  if (/^\s*#\s*point\d+\s*$/i.test(t)) return false
  if (/여행\s*약관|포함\s*내역|불포함/i.test(t) && t.length < 40) return false
  return true
}

function normalizeHanatourLine(line: string): string {
  let t = line.trim()
  t = t.replace(/\(#[^)]+\)/g, '')
  t = t.replace(/#point\d+/gi, '')
  t = t.replace(/^[\s📌•·∙※\-–—\*►▶]+\s*/, '')
  t = t.replace(/^\d+[\.)]\s+/, '')
  t = t.replace(/^[②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺]+\s*/, '')
  return t.replace(/\s{2,}/g, ' ').trim()
}

function finalize(lines: string[]): string | null {
  const out = lines
    .map((l) => normalizeHanatourLine(l))
    .filter((l) => l.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!out) return null
  return out.length > MAX_HIGHLIGHT ? out.slice(0, MAX_HIGHLIGHT) : out
}

export function extractHighlightFromHanatour(rawHtml: string | unknown): string | null {
  const raw = coerceString(rawHtml)
  if (!raw.trim()) return null
  const plain = stripTags(breakHtmlLines(raw))
  const hdr = /📌\s*상품\s*핵심\s*포인트|상품\s*핵심\s*포인트/i
  const m = plain.match(hdr)
  if (!m || m.index === undefined) return null
  let slice = plain.slice(m.index + m[0].length)
  const stopRe =
    /\n\s*(?:📌|■|▶|▷|\[포함|\[불포함|포함\s*내역|불포함\s*내역|일정\s*표|여행\s*약관|상품\s*POINT|MODE)/i
  const stop = slice.search(stopRe)
  if (stop >= 0) slice = slice.slice(0, stop)
  const rawLines = slice.split(/\n/)
  const kept = rawLines.filter(keepHanatourPointLine)
  return finalize(kept)
}

export type HanatourHighlightCorePointRow = {
  corePntSeq?: number
  corePntType?: string | null
  corePntTitlNm?: string | null
  corePntCont?: string | null
}

/** getPkgProdInfo 일부 — highlight 전용 (mustKnow와 필터 다름) */
export type HanatourHighlightProdInfoInput = {
  bnftInfoList?: HanatourHighlightCorePointRow[] | null
  rppdCntntInfoList?: HanatourHighlightCorePointRow[] | null
}

const HANATOUR_HIGHLIGHT_PRODUCT_KEEP_RE =
  /호텔|리조트|숙박|관광|체험|호핑|서핑|투어|특전|혜택|핵심|포인트|크루즈|골프|스파|뷔페|일정|포함|하이라이트|가성비|가심비|전망|야경|카약|다이빙|스노클|온천|미식|맛집|쇼핑\s*특전/i

/** SAFETY·비자·운영성·짧은 마케팅 슬로건 — 상품 판매 포인트가 아니면 제외 */
function isHanatourNonProductHighlightBlob(type: string, title: string, body: string): boolean {
  const blob = `${type}\n${title}\n${body}`
  const hasProduct = HANATOUR_HIGHLIGHT_PRODUCT_KEEP_RE.test(`${title}\n${body}`)
  if (/SAFETY|보험|여행자\s*보험|안전\s*(?:수칙|안내|보장|정보)/i.test(blob) && !hasProduct) return true
  if (/(?:비자|입국|출입국)/i.test(blob) && !hasProduct) return true
  if (/예약\s*시\s*(?:확인|유의사항)|인원별\s*차량|차량\s*(?:배정|이용\s*안내)|최소\s*출발|모객\s*안내/i.test(blob) && !hasProduct) {
    return true
  }
  // exprWrdngCont2 스타일 — 짧은 슬로건만 (상품 키워드 없음)
  const plain = body.replace(/\s+/g, ' ').trim()
  if (plain.length > 0 && plain.length < 28 && !hasProduct && !HANATOUR_HIGHLIGHT_PRODUCT_KEEP_RE.test(title)) {
    return true
  }
  return false
}

function hanatourHighlightCoreRows(info: HanatourHighlightProdInfoInput): HanatourHighlightCorePointRow[] {
  const bnft = info.bnftInfoList ?? []
  if (bnft.length > 0) return bnft
  return info.rppdCntntInfoList ?? []
}

/**
 * prodInfo bnftInfoList/rppd — 상품 판매 핵심만 multiline highlight (max 8000).
 * 보험·비자·운영·짧은 마케팅 슬로건 제외. exprWrdngCont2는 의도적으로 미사용.
 * REGRESSION-FREEZE[hanatour-register-highlight-prodinfo]: bnft product highlight — manifest
 */
export function formatHanatourHighlightPointsFromProdInfo(
  info: HanatourHighlightProdInfoInput | null | undefined,
): string | null {
  if (!info) return null
  const lines: string[] = []
  const seen = new Set<string>()
  for (const row of hanatourHighlightCoreRows(info)) {
    const type = String(row.corePntType ?? '').trim()
    const title = String(row.corePntTitlNm ?? '').trim()
    const contRaw = String(row.corePntCont ?? '').trim()
    if (!contRaw && !title) continue
    const bodyPlain = decodeEntities(stripTags(breakHtmlLines(contRaw || title)))
    if (isHanatourNonProductHighlightBlob(type, title, bodyPlain)) continue
    const bodyLines = bodyPlain
      .split(/\n/)
      .map((l) => normalizeHanatourLine(l))
      .filter((l) => l.length > 0 && keepHanatourPointLine(l))
    const titleNorm = normalizeHanatourLine(title)
    const titleUseful =
      Boolean(titleNorm) &&
      !/^(?:핵심\s*포인트|상품\s*핵심|POINT|혜택)$/i.test(titleNorm) &&
      !bodyLines.some((l) => l === titleNorm || l.startsWith(titleNorm))
    if (titleUseful && HANATOUR_HIGHLIGHT_PRODUCT_KEEP_RE.test(titleNorm)) {
      const key = titleNorm.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        lines.push(titleNorm)
      }
    }
    for (const l of bodyLines) {
      if (isHanatourNonProductHighlightBlob(type, titleNorm, l)) continue
      const key = l.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(l)
    }
  }
  return finalize(lines)
}
