/**
 * 참좋은여행 등록: 선택관광 표에서 객실·싱글차지 안내만 옵션 행으로 남지 않게 필터.
 * 옵션 전용 붙여넣기: `번호<TAB>이름<TAB>설명<TAB>비용<TAB>시간<TAB>미참가시<TAB>대기<TAB>동행` (설명은 저장하지 않음).
 */
import type { OptionalToursStructured } from '@/lib/detail-body-parser-types'

const VERYGOOD_SINGLE_ROOM_OR_SURCHARGE =
  /(1인실\s*객실|객실\s*사용\s*시|싱글\s*차지|싱글차지|싱글\s*룸|객실\s*추가\s*요금|객실추가|룸\s*차지|룸차지|1인\s*객실|싱글\s*베드|single\s*supplement|싱글\s*사용)/i

function parseEuroCell(cell: string): { amount: number; currency: string } | null {
  const t = (cell ?? '').replace(/\s+/g, ' ').trim()
  const m = t.match(/(\d+)\s*유로/i)
  if (m) return { amount: Number(m[1]), currency: 'EUR' }
  return null
}

function lineLooksLikeModetourOptionalTsv(ln: string): boolean {
  const cols = ln.split('\t').map((c) => c.trim())
  if (cols.length < 8) return false
  const c0 = cols[0] ?? ''
  const c1 = cols[1] ?? ''
  return !/^\d+$/.test(c0) && /^[A-Z]{3}$/i.test(c1)
}

/** 탭 또는 2칸 이상 공백(복사 시 탭 깨짐)으로 열 분리 */
function splitVerygoodOptionalLine(ln: string): string[] {
  const t = ln.replace(/\ufeff/g, '').trim()
  if (!t) return []
  let cols = t.split('\t').map((c) => c.replace(/\s+/g, ' ').trim())
  if (cols.length >= 8) return cols
  cols = t.split(/\s{2,}/).map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (cols.length >= 8) return cols
  /** `1 블레드 …` 단일 공백 — 번호만 분리 후 나머지를 2칸+로 재분할 */
  const m = /^(\d+)\s+([\s\S]+)$/.exec(t)
  if (!m) return []
  const rest = m[2]!.split(/\s{2,}/).map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean)
  return [m[1]!, ...rest].length >= 8 ? [m[1]!, ...rest] : []
}

function lineLooksLikeVerygoodOptionalTsv(ln: string): boolean {
  const cols = splitVerygoodOptionalLine(ln)
  if (cols.length < 8) return false
  return /^\d+$/.test(cols[0] ?? '')
}

/** 참좋은 관리자 옵션 칸: 번호+탭으로 시작하는 8열 행(모두투어 통화열 형식과 구분). */
export function parseVerygoodOptionalTourPasteSection(section: string): OptionalToursStructured {
  const raw = section.replace(/\r/g, '\n')
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\ufeff/g, '').trim())
    .filter((l) => l.length > 0)

  const rows: OptionalToursStructured['rows'] = []
  for (const ln of lines) {
    const digitStart = /^\d+(?:\t|\s)/.test(ln)
    if (!digitStart) {
      if (/^※|^참고|^가이드\s*경비|^\d+\s*박\s*\d+\s*일/i.test(ln)) break
      continue
    }
    if (lineLooksLikeModetourOptionalTsv(ln)) continue
    const cols = splitVerygoodOptionalLine(ln)
    if (cols.length < 8) continue

    const tourName = (cols[1] ?? '').slice(0, 300)
    const costCell = (cols[3] ?? '').trim()
    if (!tourName) continue

    const euro = parseEuroCell(costCell)
    const digitsOnly = costCell.replace(/,/g, '').replace(/\s/g, '')
    const adultNum = /^\d+$/.test(digitsOnly) ? Number(digitsOnly) : euro?.amount ?? null
    const currency = euro?.currency ?? ''

    const durationText = (cols[4] ?? '').slice(0, 120)
    const altRaw = (cols[5] ?? '').trim()
    const waitingRaw = (cols[6] ?? '').trim()
    const waitingPlaceText = waitingRaw === '-' ? '' : waitingRaw.slice(0, 300)
    const guide同行Text = (cols[7] ?? '').slice(0, 120)

    rows.push({
      tourName,
      currency,
      adultPrice: adultNum,
      childPrice: null,
      durationText,
      minPeopleText: '',
      guide同行Text,
      waitingPlaceText,
      descriptionText: '',
      priceText: costCell || undefined,
      alternateScheduleText: altRaw && altRaw !== '-' ? altRaw.slice(0, 500) : undefined,
    })
  }

  return {
    rows,
    reviewNeeded: rows.length > 0 && rows.every((r) => !(r.priceText?.trim() || r.adultPrice != null)),
    reviewReasons:
      rows.length > 0 && rows.every((r) => !(r.priceText?.trim() || r.adultPrice != null))
        ? ['옵션 비용 열 복원 실패 가능']
        : [],
  }
}

const VERYGOOD_OPTION_FALSE_POSITIVE =
  /핵심\s*[1-5]|핵심\s*항공|핵심\s*관광|핵심\s*포인트|핵심\s*호텔|핵심\s*식사|요약설명|노\s*옵션|노\s*쇼핑|자유시간\s*제공|마일리지|적립\s*\(/i

export function filterVerygoodOptionalTourRows(
  rows: OptionalToursStructured['rows']
): OptionalToursStructured['rows'] {
  return rows.filter((r) => {
    const blob = `${r.tourName} ${r.descriptionText ?? ''} ${r.waitingPlaceText ?? ''}`
    if (VERYGOOD_OPTION_FALSE_POSITIVE.test(blob)) return false
    if (/선택관광이\s*없는|선택\s*관광\s*없음|옵션이\s*없는|현지\s*옵션\s*없음/i.test(blob)) return false
    if (/^선택관광명$/i.test((r.tourName ?? '').trim())) return false
    if (VERYGOOD_SINGLE_ROOM_OR_SURCHARGE.test(blob)) return false
    return true
  })
}

/**
 * 참좋은 정형 옵션칸이 비정형 본문 휴리스틱보다 우선할지 — 모두 8열 통화표가 우세하면 제외.
 */
export function verygoodOptionalPasteDominatesUnstructured(section: string, pasteRowCount: number): boolean {
  if (pasteRowCount <= 0 || !/\t/.test(section)) return false
  const lines = section.replace(/\r/g, '\n').split('\n').filter((l) => l.includes('\t') && l.split('\t').length >= 8)
  if (lines.length === 0) return false
  const vg = lines.filter(lineLooksLikeVerygoodOptionalTsv).length
  const md = lines.filter(lineLooksLikeModetourOptionalTsv).length
  if (md > vg) return false
  return vg > 0 || /관광명/i.test(section)
}
