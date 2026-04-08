/**
 * 모두투어 현지옵션: 싱글차지·1인 객실사용요금 등은 불포함/호텔 영역만 — 옵션 테이블에서 제거.
 * 정형 붙여넣기: `이름<TAB>통화(3자)<TAB>성인<TAB>아동<TAB>소요<TAB>최소<TAB>동행<TAB>미참여·대기`
 */
import type { OptionalToursStructured } from '@/lib/detail-body-parser-types'

const MODETOUR_OPTIONAL_SINGLE_OR_ROOM_CHARGE_RE =
  /1인\s*객실\s*사용\s*요금|1인\s*객실\s*이용|1인\s*객실|1인실|1인\s*룸|싱글\s*차지|싱글차지|싱글룸|싱글\s*룸\s*추가\s*요금|싱글룸\s*추가\s*요금|독실\s*사용|룸\s*차지|객실\s*차지|1인\s*사용료|패널티|single\s*supplement|객실\s*추가\s*요금|room\s*charge/i

export function isModetourSingleSupplementLikeOptionalRow(row: {
  tourName: string
  descriptionText?: string
  noteText?: string
}): boolean {
  const blob = [row.tourName, row.descriptionText ?? '', row.noteText ?? ''].join(' ')
  return MODETOUR_OPTIONAL_SINGLE_OR_ROOM_CHARGE_RE.test(blob)
}

export function filterModetourOptionalTourRows<
  T extends { tourName: string; descriptionText?: string; noteText?: string },
>(rows: T[]): T[] {
  return rows.filter((r) => {
    const tn = (r.tourName ?? '').replace(/\s+/g, ' ').trim()
    if (/선택관광이\s*없는|선택\s*관광\s*없음|옵션이\s*없는|현지\s*옵션\s*없음/i.test(tn)) return false
    if (/^선택관광명$/i.test(tn)) return false
    return !isModetourSingleSupplementLikeOptionalRow(r)
  })
}

/** 탭 한 줄 = 한 옵션(첫 열은 번호만 있는 참좋은 행과 구분). */
export function parseModetourOptionalTourPasteSection(section: string): OptionalToursStructured {
  const raw = section.replace(/\r/g, '\n')
  if (!/\t/.test(raw)) return { rows: [], reviewNeeded: false, reviewReasons: [] }
  const lines = raw.split('\n').map((l) => l.replace(/\ufeff/g, '').trim()).filter(Boolean)
  const rows: OptionalToursStructured['rows'] = []
  for (const ln of lines) {
    if (/^선택관광명\b|^관광명\b|^번호\b.*\t.*통화/i.test(ln)) continue
    const cols = ln.split('\t').map((c) => c.replace(/\s+/g, ' ').trim())
    if (cols.length < 8) continue
    const c0 = cols[0] ?? ''
    if (/^\d+$/.test(c0)) continue
    const c1 = (cols[1] ?? '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(c1)) continue
    const adult = Number(String(cols[2] ?? '').replace(/,/g, ''))
    const child = Number(String(cols[3] ?? '').replace(/,/g, ''))
    if (!Number.isFinite(adult)) continue
    const optionName = c0.replace(/^#\s*/, '').trim()
    const durationText = (cols[4] ?? '').slice(0, 120)
    const minPeopleText = (cols[5] ?? '').slice(0, 120)
    const guide同行Text = (cols[6] ?? '').slice(0, 120)
    const waitingPlaceText = (cols[7] ?? '').slice(0, 500)
    const childPart = Number.isFinite(child) ? ` / 아동 ${c1} ${child}` : ''
    const priceText = `성인 ${c1} ${adult}${childPart}`
    rows.push({
      tourName: optionName || '옵션',
      currency: c1,
      adultPrice: adult,
      childPrice: Number.isFinite(child) ? child : null,
      durationText,
      minPeopleText,
      guide同行Text,
      waitingPlaceText,
      descriptionText: '',
      priceText,
      alternateScheduleText: waitingPlaceText || undefined,
    })
  }
  return { rows, reviewNeeded: false, reviewReasons: [] }
}

/** 참좋은 숫자-첫열 탭 표가 아닐 때만 모두 정형으로 본다. */
export function modetourOptionalPasteDominatesUnstructured(section: string, pasteRowCount: number): boolean {
  if (pasteRowCount <= 0 || !/\t/.test(section)) return false
  const lines = section.replace(/\r/g, '\n').split('\n').filter((l) => l.trim())
  const dataLines = lines.filter((l) => l.includes('\t') && l.split('\t').length >= 8)
  if (dataLines.length === 0) return false
  const modetourLike = dataLines.filter((l) => {
    const c0 = l.split('\t')[0]?.trim() ?? ''
    const c1 = (l.split('\t')[1] ?? '').trim()
    return !/^\d+$/.test(c0) && /^[A-Z]{3}$/i.test(c1)
  })
  return modetourLike.length >= Math.ceil(dataLines.length * 0.5)
}

export function countRegisterOptionalToursJsonRows(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  try {
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? a.length : null
  } catch {
    return null
  }
}

/** confirm 재전송·레거시 JSON에서 싱글차지 계열 행 제거 */
export function filterModetourOptionalToursStructuredJson(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = raw.trim()
  if (!t) return raw
  try {
    const parsed = JSON.parse(t) as unknown
    if (!Array.isArray(parsed)) return raw
    const filtered = parsed.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return true
      const o = item as Record<string, unknown>
      const tourName =
        typeof o.tourName === 'string'
          ? o.tourName
          : typeof o.name === 'string'
            ? o.name
            : ''
      const descriptionText =
        typeof o.descriptionText === 'string'
          ? o.descriptionText
          : typeof o.raw === 'string'
            ? o.raw
            : ''
      const noteText = typeof o.noteText === 'string' ? o.noteText : ''
      return !isModetourSingleSupplementLikeOptionalRow({ tourName, descriptionText, noteText })
    })
    return JSON.stringify(filtered)
  } catch {
    return raw
  }
}
