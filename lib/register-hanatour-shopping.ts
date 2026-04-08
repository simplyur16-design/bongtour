/**
 * 하나투어 등록: 쇼핑 도시/샵/위치/품목/시간 분리 보강 + 옵션성 문구 오탐 제거.
 */
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

/** `sanitizeHanatourShoppingStructured` 레이블 붙은 붙여넣기 — enrich·본문 필터 우회 */
export const HANATOUR_MANUAL_SHOPPING_NOTE = '__hanatour_manual_shopping__'

/** 5열 TSV 행 파싱 실패 — `noteText`에만 사용 */
export const HANATOUR_TAB_ROW_PARSE_ISSUE_PREFIX = '__hanatour_shopping_row_issue__'

/** 본문 `쇼핑 N회` 등 — 행 수와 무관 */
export function parseHanatourShoppingVisitCountFromText(t: string | null | undefined): number | null {
  const s = (t ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  const mSchedule =
    s.match(
      /(?:시내면세점|면세점|쇼핑센터|아울렛)\s*(\d+)\s*회\s*방문|(\d+)\s*회\s*방문[^\n]{0,24}(?:시내면세|면세|쇼핑센터)/i
    ) || s.match(/쇼핑\s*(\d+)\s*회\s*방문/i)
  if (mSchedule) {
    const n = Number(mSchedule[1] || mSchedule[2])
    if (Number.isFinite(n) && n >= 0 && n <= 99) return n
  }
  const m =
    s.match(/쇼핑\s*(\d+)\s*회|쇼핑(\d+)회|총\s*(\d+)\s*회|쇼핑횟수\s*총\s*(\d+)\s*회/i)
  if (m) {
    const n = Number(m[1] || m[2] || m[3] || m[4])
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

/**
 * 본문 전체(상단 핵심 → 일정 → 기타 순으로 줄 단위 스캔)에서 방문 **횟수**만 추출.
 * 쇼핑 후보지 행 개수·표 행 수와 혼동하지 않음.
 */
export function extractHanatourShoppingVisitCountFromFullBodyText(text: string): number | null {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ')
  /** 상단 핵심 한 줄 칩: `2박 3일LCC쇼핑 1회단체여행…` — 줄 나눔 전에도 첫 `쇼핑 N회`를 잡음 */
  const flat = normalized.replace(/\s+/g, ' ').trim()
  const firstChip = flat.match(/쇼핑\s*(\d{1,2})\s*회(?!\s*방문)/i)
  if (firstChip) {
    const n = Number(firstChip[1])
    if (Number.isFinite(n) && n >= 0 && n <= 99) return n
  }
  const lines = normalized.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  for (const line of lines) {
    const m1 =
      line.match(/쇼핑\s*(\d+)\s*회(?!\s*방문)/i) || line.match(/쇼핑(\d+)회(?!\s*방문)/i)
    if (m1) {
      const n = Number(m1[1])
      if (Number.isFinite(n) && n >= 0 && n <= 99) return n
    }
  }
  for (const line of lines) {
    const m2 = line.match(
      /(?:시내면세점|면세점|쇼핑센터|아울렛|쇼핑몰|백화점)\s*(\d+)\s*회\s*방문/i
    )
    if (m2) {
      const n = Number(m2[1])
      if (Number.isFinite(n) && n >= 0 && n <= 99) return n
    }
  }
  return parseHanatourShoppingVisitCountFromText(normalized)
}

function pickHanatourShoppingVisitCountWithoutRowFallback(parsed: RegisterParsed): number | null {
  const vc = parsed.shoppingVisitCount
  if (vc != null && Number.isFinite(Number(vc)) && Number(vc) > 0) return Number(vc)
  const fromSummary = parseHanatourShoppingVisitCountFromText(parsed.shoppingSummaryText)
  if (fromSummary != null) return fromSummary
  const st = parsed.detailBodyStructured?.shoppingStructured
  return parseHanatourShoppingVisitCountFromText(st?.shoppingCountText)
}

function looksLikeHanatourTabShoppingHeader(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!/도시/.test(t) || !/(쇼핑\s*샵\s*명|쇼핑샵명)/i.test(t) || !/품목/.test(t) || !/소요\s*시간|소요시간/i.test(t)) {
    return false
  }
  if (line.includes('\t')) return true
  return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean).length >= 4
}

function splitHanatourShoppingCols(line: string): string[] {
  const t = line.trimEnd()
  if (t.includes('\t')) return t.split('\t').map((s) => s.trim())
  return t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
}

/**
 * TSV: `도시\t쇼핑샵명(위치)\t품목\t소요시간` — 샵명·주소가 다음 행으로 이어질 수 있음.
 * 각 행은 후보 쇼핑점 1곳(candidateOnly); 행 수 ≠ 실제 쇼핑 횟수.
 */
export function parseHanatourTabShoppingPaste(raw: string): ShoppingStructured['rows'] | null {
  const lines = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').split('\n').map((l) => l.trimEnd())
  const nonEmpty = lines.filter((l) => l.length > 0)
  if (nonEmpty.length < 2) return null
  if (!looksLikeHanatourTabShoppingHeader(nonEmpty[0]!)) return null

  const rows: ShoppingStructured['rows'] = []
  let i = 1
  while (i < nonEmpty.length) {
    const parts = splitHanatourShoppingCols(nonEmpty[i]!)
    if (parts.length >= 4 && parts[0] && parts[1] && parts[2] && parts[3]) {
      const city = parts[0]!
      const shopName = parts[1]!
      const item = parts[2]!
      const dur = parts[3]!
      rows.push({
        city,
        shopName,
        shopLocation: null,
        itemsText: item,
        shoppingItem: item,
        shoppingPlace: city,
        durationText: dur,
        refundPolicyText: '',
        candidateOnly: true,
        noteText: HANATOUR_MANUAL_SHOPPING_NOTE,
      })
      i++
      continue
    }
    if (parts.length === 2 && parts[0] && parts[1] && i + 1 < nonEmpty.length) {
      const p2 = splitHanatourShoppingCols(nonEmpty[i + 1]!)
      if (p2.length >= 3 && p2[0] && p2[1] && p2[2]) {
        const city = parts[0]!
        const shopLine1 = parts[1]!
        const shopRest = p2[0]!
        const item = p2[1]!
        const dur = p2[2]!
        const shopName = [shopLine1, shopRest].filter(Boolean).join('\n')
        rows.push({
          city,
          shopName,
          shopLocation: null,
          itemsText: item,
          shoppingItem: item,
          shoppingPlace: city,
          durationText: dur,
          refundPolicyText: '',
          candidateOnly: true,
          noteText: HANATOUR_MANUAL_SHOPPING_NOTE,
        })
        i += 2
        continue
      }
    }
    i++
  }
  return rows.length > 0 ? rows : null
}

/**
 * 헤더 없이 `도시\t상호\t주소\t품목\t소요시간` 형태만 있는 붙여넣기 (6줄 등).
 * `parseHanatourTabShoppingPaste`는 헤더 행이 있어야 하므로, 무헤더 TSV는 여기서 처리한다.
 */
export function parseHanatourTabShoppingFiveColumnLines(raw: string): ShoppingStructured['rows'] | null {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  if (!lines.some((l) => l.includes('\t') || l.split(/\s{2,}/).filter(Boolean).length >= 4)) return null
  const rows: ShoppingStructured['rows'] = []
  for (const line of lines) {
    const parts = splitHanatourShoppingCols(line)
    if (parts.length < 2 && !line.includes('\t')) {
      rows.push({
        shoppingItem: '',
        shoppingPlace: line,
        durationText: '',
        refundPolicyText: '',
        city: null,
        shopName: null,
        shopLocation: null,
        itemsText: null,
        noteText: `${HANATOUR_TAB_ROW_PARSE_ISSUE_PREFIX}: 열 분리 실패`,
        candidateOnly: false,
      })
      continue
    }
    if (parts.length < 5) {
      const city = parts[0] ?? ''
      const name = parts[1] ?? ''
      const addr = parts[2] ?? ''
      const items = parts[3] ?? ''
      const dur = parts[4] ?? ''
      rows.push({
        city: city || null,
        shopName: name || null,
        shopLocation: addr || null,
        itemsText: items || null,
        shoppingItem: items || name || city || '',
        shoppingPlace: [city, name, addr].filter(Boolean).join(' · '),
        durationText: dur,
        refundPolicyText: '',
        noteText: `${HANATOUR_TAB_ROW_PARSE_ISSUE_PREFIX}: 열 ${parts.length}/5`,
        candidateOnly: false,
      })
      continue
    }
    const [city, name, address, items, durationText, ...rest] = parts
    const extra = rest.filter(Boolean).join(' ').trim()
    const placeJoined = [city, name, address].filter(Boolean).join(' · ')
    rows.push({
      city: city || null,
      shopName: name || null,
      shopLocation: address || null,
      itemsText: items || null,
      shoppingItem: (items || name || city || '').trim(),
      shoppingPlace: extra ? `${placeJoined} ${extra}`.trim() : placeJoined,
      durationText: (durationText || '').trim(),
      refundPolicyText: '',
      noteText: HANATOUR_MANUAL_SHOPPING_NOTE,
      candidateOnly: true,
    })
  }
  return rows.length > 0 ? rows : null
}

function splitHanatourManualShoppingBlocks(raw: string): string[] {
  const text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
  if (!text) return []
  const parts = text.split(/\n(?=\s*도시\s*[:：])/i)
  const blocks: string[] = []
  for (const p of parts) {
    let b = p.replace(/^\d+[\).\s]*\n?/m, '').replace(/\n+\d+[\).\s]*$/m, '').trim()
    if (!b) continue
    if (/^도시\s*[:：]/i.test(b)) blocks.push(b)
  }
  return blocks
}

/**
 * 하나투어 쇼핑 전용 입력란(도시 / 쇼핑샵명(위치) 줄바꿈 / 품목 / 소요시간).
 * LLM 없이 structured row로만 변환한다.
 */
export function parseHanatourManualShoppingPaste(raw: string): ShoppingStructured['rows'] {
  const blocks = splitHanatourManualShoppingBlocks(raw)
  const rows: ShoppingStructured['rows'] = []

  for (const seg of blocks) {
    const cityM = /(?:^|\n)\s*도시\s*[:：]\s*([^\n]+)/i.exec(seg)
    const city = (cityM?.[1] ?? '').trim()

    const shopM =
      /쇼핑샵명\s*\(\s*위치\s*\)\s*[:：]\s*([\s\S]*?)(?=^\s*품목\s*[:：]|^\s*소요시간\s*[:：])/im.exec(seg)
    let shopName = ''
    let shopLocation = ''
    if (shopM?.[1] != null) {
      const shopLines = shopM[1]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      shopName = shopLines[0] ?? ''
      shopLocation = shopLines.slice(1).join('\n').trim()
    }

    const itemsM = /(?:^|\n)\s*품목\s*[:：]\s*([^\n]+)/im.exec(seg)
    const itemsText = (itemsM?.[1] ?? '').trim()

    const durM = /(?:^|\n)\s*소요시간\s*[:：]\s*([^\n]+)/im.exec(seg)
    const durationText = (durM?.[1] ?? '').trim()

    if (!city && !shopName && !itemsText && !durationText) continue

    const placeCombined = [city, shopName, shopLocation].filter(Boolean).join(' · ')
    rows.push({
      city: city || null,
      shopName: shopName || null,
      shopLocation: shopLocation || null,
      itemsText: itemsText || null,
      shoppingItem: itemsText || shopName || city || '',
      shoppingPlace: placeCombined,
      durationText,
      refundPolicyText: '',
      noteText: HANATOUR_MANUAL_SHOPPING_NOTE,
      candidateOnly: true,
    })
  }

  return rows
}

export function hanatourShoppingRowLooksPlausible(r: ShoppingStructured['rows'][number]): boolean {
  if (r.noteText === HANATOUR_MANUAL_SHOPPING_NOTE || r.candidateOnly === true) {
    return (
      Boolean((r.city ?? '').trim()) ||
      Boolean((r.shopName ?? '').trim()) ||
      Boolean((r.itemsText ?? '').trim()) ||
      Boolean((r.durationText ?? '').trim()) ||
      Boolean((r.shoppingItem ?? '').trim())
    )
  }
  const item = (r.shoppingItem ?? '').trim()
  const place = (r.shoppingPlace ?? '').trim()
  const dur = (r.durationText ?? '').trim()
  const ref = (r.refundPolicyText ?? '').trim()
  const hay = `${item} ${place} ${dur} ${ref}`
  if (/(옵션\s*투어|선택\s*관광|참가비\s*안내|유류\s*할증)/i.test(item) && !/(면세|아울렛|쇼핑품목)/i.test(hay)) return false
  if (item.length > 150 && !place && !dur) return false
  const hasSignal =
    /(도시|샵|매장|면세|아울렛|품목|장소|소요|환불)/i.test(hay) || place.length > 0 || (dur.length > 0 && ref.length > 0)
  if (!hasSignal && item.length > 60) return false
  return item.length > 0 || place.length > 0
}

export const EMPTY_HANATOUR_SHOPPING: ShoppingStructured = {
  rows: [],
  shoppingCountText: '',
  reviewNeeded: false,
  reviewReasons: [],
}

export function sanitizeHanatourShoppingStructured(
  _shoppingSection: string,
  _structured: ShoppingStructured,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  const pasted = shoppingPasteRaw?.trim()
  if (!pasted) {
    /** 하나투어: 쇼핑 전용 입력란 비어 있으면 본문(unstructured) 파싀 결과를 쓰지 않음 */
    return { ...EMPTY_HANATOUR_SHOPPING }
  }
  const tabRows = parseHanatourTabShoppingPaste(pasted)
  const fiveColRows = tabRows == null ? parseHanatourTabShoppingFiveColumnLines(pasted) : null
  const rows = tabRows ?? fiveColRows ?? parseHanatourManualShoppingPaste(pasted)
  const n = rows.length
  const hasIssue = rows.some((r) =>
    String(r.noteText ?? '').startsWith(HANATOUR_TAB_ROW_PARSE_ISSUE_PREFIX)
  )
  return {
    rows,
    shoppingCountText: '',
    reviewNeeded: n === 0 || hasIssue,
    reviewReasons:
      n === 0
        ? ['쇼핑 전용 입력 파싱 결과 행 없음']
        : hasIssue
          ? ['일부 행 열 수 불일치(탭 5열 권장)']
          : [],
  }
}

/** 입력란 비어 있음 — finalize에서 LLM/시그널 쇼핑 잔여 제거용 */
export function hanatourShoppingPasteIsEmpty(parsed: { detailBodyStructured?: { raw?: { shoppingPasteRaw?: string | null } } | null }): boolean {
  return !parsed.detailBodyStructured?.raw?.shoppingPasteRaw?.trim()
}

export function finalizeHanatourRegisterParsedShopping(parsed: RegisterParsed): RegisterParsed {
  const pasted = parsed.detailBodyStructured?.raw?.shoppingPasteRaw?.trim()
  if (!pasted) {
    const db = parsed.detailBodyStructured
    const nextDetail =
      db != null
        ? {
            ...db,
            shoppingStructured: { ...EMPTY_HANATOUR_SHOPPING },
            raw: { ...db.raw },
          }
        : null
    const issues = (parsed.extractionFieldIssues ?? []).filter((x) => x.field !== 'shoppingStops')
    return {
      ...parsed,
      hasShopping: false,
      shoppingVisitCount: null,
      shoppingSummaryText: undefined,
      shoppingNoticeRaw: undefined,
      shoppingStops: undefined,
      shoppingStopsLlmSupplementJson: parsed.shoppingStopsLlmSupplementJson ?? null,
      detailBodyStructured: nextDetail ?? parsed.detailBodyStructured,
      extractionFieldIssues: issues.length !== (parsed.extractionFieldIssues ?? []).length ? issues : parsed.extractionFieldIssues,
    }
  }
  const st = parsed.detailBodyStructured?.shoppingStructured
  const n = st?.rows?.length ?? 0
  if (n > 0) {
    const allCandidate = st!.rows.every((r) => r.candidateOnly === true)
    if (allCandidate) {
      const finalVisit = pickHanatourShoppingVisitCountWithoutRowFallback(parsed)
      const rowN = st!.rows.length
      return {
        ...parsed,
        hasShopping: true,
        shoppingVisitCount: finalVisit,
        shoppingSummaryText: parsed.shoppingSummaryText?.trim()
          ? parsed.shoppingSummaryText
          : finalVisit != null
            ? `쇼핑 ${finalVisit}회`
            : rowN > 0
              ? `쇼핑 ${rowN}곳(후보)`
              : '쇼핑 후보 안내',
      }
    }
    const visitCount = pickHanatourShoppingVisitCountWithoutRowFallback(parsed)
    return {
      ...parsed,
      shoppingVisitCount: visitCount,
      hasShopping: true,
      shoppingSummaryText: parsed.shoppingSummaryText?.trim()
        ? parsed.shoppingSummaryText
        : visitCount != null
          ? `쇼핑 ${visitCount}회`
          : undefined,
    }
  }
  const db = parsed.detailBodyStructured
  const nextDetail =
    db != null
      ? {
          ...db,
          shoppingStructured: { ...EMPTY_HANATOUR_SHOPPING },
          raw: { ...db.raw },
        }
      : null
  const issues = (parsed.extractionFieldIssues ?? []).filter((x) => x.field !== 'shoppingStops')
  return {
    ...parsed,
    hasShopping: false,
    shoppingVisitCount: null,
    shoppingSummaryText: undefined,
    shoppingNoticeRaw: undefined,
    shoppingStops: undefined,
    detailBodyStructured: nextDetail ?? parsed.detailBodyStructured,
    extractionFieldIssues:
      issues.length !== (parsed.extractionFieldIssues ?? []).length ? issues : parsed.extractionFieldIssues,
  }
}
