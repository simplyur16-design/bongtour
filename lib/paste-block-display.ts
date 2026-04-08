/**
 * 관리자 붙여넣기 원문(현지옵션/쇼핑)을 LLM 없이 공개 상세용 카드로 나눈다.
 * 입력 손실 없음: 파싱 실패 시 단일 블록으로 원문 유지.
 */

export type PublicPasteDisplayBlock = {
  title: string
  description: string
  price: string
  duration: string
  note: string
}

const PRICE_LINE =
  /^(?:가격|금액|요금|비용|성인|아동|Adult|Child|USD|KRW|EUR|JPY)\s*[:：]?\s*(.+)$/i
const DURATION_LINE = /^(?:소요\s*시간|소요시간|진행\s*시간|진행|소요)\s*[:：]?\s*(.+)$/i
const NOTE_LINE = /^(?:비고|메모|안내|유의|참고|특이\s*사항)\s*[:：]\s*(.+)$/i
const BOOKING_LINE = /^(?:신청|예약|접수)\s*[:：]?\s*(.+)$/i

function trimJoin(lines: string[]): string {
  return lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function splitIntoRawBlocks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []
  if (/\n\s*\n/.test(normalized)) {
    const para = normalized
      .split(/\n\s*\n+/)
      .map((b) => b.trim())
      .filter(Boolean)
    if (para.length > 1) return para
  }
  const lines = normalized.split('\n')
  const chunks: string[] = []
  let cur: string[] = []
  const flush = () => {
    const j = trimJoin(cur)
    if (j) chunks.push(j)
    cur = []
  }
  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      if (cur.length) flush()
      continue
    }
    const numbered = /^\d{1,2}[\.\)]\s+\S/.test(t)
    const bullet = /^[-*•◇◆]\s+\S/.test(t)
    if ((numbered || bullet) && cur.length) flush()
    cur.push(line)
  }
  flush()
  return chunks.length ? chunks : [normalized]
}

function parseOneBlock(raw: string): PublicPasteDisplayBlock {
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (!lines.length) {
    return { title: '', description: '', price: '', duration: '', note: '' }
  }
  if (lines.length === 1 && lines[0]!.length > 100) {
    return { title: '입력 안내', description: lines[0]!, price: '', duration: '', note: '' }
  }
  const title = lines[0]!.length > 120 ? `${lines[0]!.slice(0, 117)}…` : lines[0]!
  const desc: string[] = []
  let price = ''
  let duration = ''
  let note = ''
  let booking = ''
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i]!
    let m = ln.match(PRICE_LINE)
    if (m) {
      price = price ? `${price} · ${m[1]!.trim()}` : m[1]!.trim()
      continue
    }
    m = ln.match(DURATION_LINE)
    if (m) {
      duration = duration ? `${duration} · ${m[1]!.trim()}` : m[1]!.trim()
      continue
    }
    m = ln.match(NOTE_LINE)
    if (m) {
      note = note ? `${note}\n${m[1]!.trim()}` : m[1]!.trim()
      continue
    }
    m = ln.match(BOOKING_LINE)
    if (m) {
      booking = booking ? `${booking} · ${m[1]!.trim()}` : m[1]!.trim()
      continue
    }
    if (/원(?:\s|$|,)|\$|€|£|¥|KRW|USD|EUR|JPY|\d{1,3}(?:,\d{3})+/.test(ln) && ln.length < 160) {
      price = price ? `${price} · ${ln}` : ln
      continue
    }
    if (/\d+\s*(?:시간|분|hr|h|min)/i.test(ln) && ln.length < 120) {
      duration = duration ? `${duration} · ${ln}` : ln
      continue
    }
    desc.push(ln)
  }
  let description = trimJoin(desc)
  if (booking) {
    description = description ? `${description}\n신청: ${booking}` : `신청: ${booking}`
  }
  return { title, description, price, duration, note }
}

/** 현지옵션 붙여넣기 → 읽기용 블록 (0블록이면 빈 배열) */
export function parseOptionalPasteForPublicDisplay(raw: string | null | undefined): PublicPasteDisplayBlock[] {
  const t = String(raw ?? '').trim()
  if (!t) return []
  const chunks = splitIntoRawBlocks(t)
  if (!chunks.length) return []
  const blocks = chunks.map(parseOneBlock).filter((b) => b.title || b.description || b.price || b.duration || b.note)
  if (!blocks.length) return [{ title: '안내', description: t, price: '', duration: '', note: '' }]
  return blocks
}

/** 쇼핑 붙여넣기 — 현지옵션과 동일 결정적 규칙 */
export const parseShoppingPasteForPublicDisplay = parseOptionalPasteForPublicDisplay
