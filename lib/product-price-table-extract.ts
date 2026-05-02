/**
 * 본문 상품가격 구분표(연령·침대 구분) — 구분 라벨 기준 슬롯 매핑.
 * 숫자 열 순서만으로 추측하지 않음. 성인→아동·유아 복사 없음.
 */

import type { BodyProductPriceTable } from '@/lib/public-product-extras'

export type ProductPriceTableByLabels = {
  adultPrice: number | null
  childExtraBedPrice: number | null
  childNoBedPrice: number | null
  infantPrice: number | null
}

type Slot = 'adult' | 'childExtra' | 'childNo' | 'infant'

function parseKrwToken(s: string): number | null {
  const m = String(s).match(/([\d,]{2,14})/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** 본가(행 단가): 동일 줄에서 유류·제세·할증·공과 직전의 '원' 금액은 제외하고 첫 후보 */
function firstMainKrwInLine(line: string): number | null {
  const re = /([\d,]{2,14})\s*원/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const start = m.index
    const pre = line.slice(Math.max(0, start - 16), start)
    if (/(유류|제세|할증|공과)\s*$/i.test(pre)) continue
    const n = parseKrwToken(m[1])
    if (n != null) return n
  }
  return null
}

/** 목록 마커(-, *, •) 및 "1. " 접두 제거 — 모두투어식 "- 성인 918,900원" 행 인식 */
function stripLeadingPriceRowNoise(s: string): string {
  return s
    .replace(/\r/g, '')
    .trim()
    .replace(/^[-*•·]+\s*/u, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim()
}

function detectTierSlot(labelOrLine: string): Slot | null {
  const s = labelOrLine.replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (
    /아동\s*[（(]\s*extra\s*bed/i.test(s) ||
    /아동\s*extra\s*bed/i.test(s) ||
    /아동\s*\(\s*extra/i.test(s)
  )
    return 'childExtra'
  if (
    /아동\s*[（(]\s*no\s*bed/i.test(s) ||
    /아동\s*no\s*bed/i.test(s) ||
    /아동\s*\(\s*no\s*bed/i.test(s)
  )
    return 'childNo'
  // JS \b는 한글 경계를 보장하지 않음 → 뒤 경계를 명시
  if (
    /^유아(?:만)?(?=[\s\d(;]|$)/i.test(s) ||
    /^소아\s*\(\s*만\s*2\s*세\s*미만/i.test(s)
  )
    return 'infant'
  if (/^성인(?:만)?(?=[\s\d(;]|$)/i.test(s)) return 'adult'
  return null
}

function splitRowCells(line: string): string[] {
  const ln = line.replace(/\r/g, '')
  if (ln.includes('\t')) return ln.split('\t').map((x) => x.trim())
  return ln.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean)
}

/** 모두투어식 한 줄 나열: "성인 …원 (유류…), 아동 Extra Bed …원, …" */
function expandCommaSeparatedTierLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (/,/.test(t) && /원/.test(t) && /(?:아동|유아|성인)/.test(t)) {
      const parts = t.split(/,\s*(?=(?:아동|유아|성인)(?:[\s(]|$))/)
      if (parts.length >= 2) {
        out.push(...parts.map((p) => p.trim()).filter(Boolean))
        continue
      }
    }
    out.push(t)
  }
  return out
}

/** 구분 열(0) + 가격 열(1) 전제 시 본가는 가격 열 우선 */
function priceForRow(line: string, cells: string[]): number | null {
  if (cells.length >= 2) {
    const pCell = cells[1] ?? ''
    const fromCell = firstMainKrwInLine(pCell) ?? parseKrwToken(pCell)
    if (fromCell != null) return fromCell
  }
  return firstMainKrwInLine(line)
}

/**
 * pasted 가격표/본문에서 구분 라벨이 있는 행만 읽어 슬롯별 원화 단가 추출.
 * 표 헤더(구분+가격) 또는 동일 블록 내 2개 이상 슬롯이 확인될 때만 신뢰.
 */
export function extractProductPriceTableByLabels(blob: string): ProductPriceTableByLabels | null {
  if (!blob?.trim()) return null
  const raw = blob.replace(/\r/g, '\n')
  const lines = expandCommaSeparatedTierLines(raw.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()))
  const hasTableHeader =
    lines.some((l) => /구분/i.test(l) && /가격/i.test(l)) ||
    (lines.some((l) => /^구분\b/i.test(l.trim())) && lines.some((l) => /^가격\b/i.test(l.trim())))

  const out: ProductPriceTableByLabels = {
    adultPrice: null,
    childExtraBedPrice: null,
    childNoBedPrice: null,
    infantPrice: null,
  }

  const set = (slot: Slot, n: number) => {
    if (slot === 'adult') out.adultPrice = n
    else if (slot === 'childExtra') out.childExtraBedPrice = n
    else if (slot === 'childNo') out.childNoBedPrice = n
    else out.infantPrice = n
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t || /^구분\b/i.test(t)) continue
    if (/^(가격|연령|만\s*\d+)/i.test(t) && t.length < 24) continue

    const tClean = stripLeadingPriceRowNoise(t)
    if (!tClean) continue

    const cells = splitRowCells(tClean).map((c) => stripLeadingPriceRowNoise(c))
    const label = (cells[0] ?? tClean).trim()
    const slot = detectTierSlot(label) ?? detectTierSlot(tClean)
    if (slot == null) continue

    const price = priceForRow(tClean, cells)
    if (price == null) continue
    set(slot, price)
  }

  const filled = [out.adultPrice, out.childExtraBedPrice, out.childNoBedPrice, out.infantPrice].filter((x) => x != null).length
  if (filled === 0) return null
  // 구분+가격 헤더 없이 슬롯이 1개뿐이면 오탐을 줄이려던 규칙이었으나, 미리보기(LLM이 상품가격표 JSON을 비움)에서
  // pasted 가격표의 「성인 …원」 한 줄만으로는 filled===1이라 null이 되어 기본가 전체가 빠지는 문제가 생긴다.
  if (!hasTableHeader && filled < 2 && out.adultPrice == null) return null

  return out
}

type TableLike = ProductPriceTableByLabels

function tableLikeFromBody(t: BodyProductPriceTable | null | undefined): TableLike | null {
  if (!t) return null
  return {
    adultPrice: t.adultPrice ?? null,
    childExtraBedPrice: t.childExtraBedPrice ?? null,
    childNoBedPrice: t.childNoBedPrice ?? null,
    infantPrice: t.infantPrice ?? null,
  }
}

/**
 * 라벨 추출값이 있으면 해당 슬롯은 추출 우선(LLM 보정). 없으면 기존 유지.
 *
 * [용도] 등록 파이프라인(register-parse)은 전 상품 LLM 표 + 본문 라벨 병합에 사용(공급사 중립 유틸).
 * [모두투어 전용 호출] 공개 상세 `app/products/[id]/page.tsx`에서는 modetour 컨텍스트에서만 병합 결과를 가격 merge에 넘긴다.
 */
export function mergeProductPriceTableWithLabelExtract(
  base: BodyProductPriceTable | ProductPriceTableByLabels | null | undefined,
  extracted: TableLike | null
): TableLike | null {
  const b = base != null ? tableLikeFromBody(base as BodyProductPriceTable) : null
  if (!extracted && !b) return null
  if (!extracted) return b
  if (!b) return extracted
  return {
    adultPrice: extracted.adultPrice ?? b.adultPrice,
    childExtraBedPrice: extracted.childExtraBedPrice ?? b.childExtraBedPrice,
    childNoBedPrice: extracted.childNoBedPrice ?? b.childNoBedPrice,
    infantPrice: extracted.infantPrice ?? b.infantPrice,
  }
}
