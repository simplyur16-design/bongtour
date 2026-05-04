/** 롯데관광 등록 전용: 비정형 옵션·쇼핑 본문 휴리스틱. `register-input-parse-lottetour`만 import. */
import type { OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'

/** 롯데관광 비정형 본문 전용 표·줄 키워드 */
const OPTIONAL_HEADER_ALIASES = {
  tourName: [
    '선택관광명',
    '관광명',
    '투어명',
    '선택옵션명',
    '현지옵션명',
    '옵션명',
    '롯데 옵션',
    '롯데관광 옵션',
    '옐로우 옵션',
    '롯데 옵션',
  ],
  currency: ['통화', '화폐', 'CUR', 'currency'],
  adultPrice: ['성인', '비용', '금액', '요금', '가격', '선택관광비용', '1인요금', '성인요금'],
  childPrice: ['아동', '소아', '아동요금', '소아요금'],
  durationText: ['소요시간', '시간', '이용시간', '예상시간', '진행시간'],
  minPeopleText: ['최소인원', '최소출발인원', '최소행사인원', '최소참여인원'],
  guide同行Text: ['동행여부', '가이드동행', '가이드 및 인솔자 동행여부', '인솔자동행', '가이드 동행 여부'],
  waitingPlaceText: ['미참여시 대기장소', '대기장소', '미참가시 대기일정', '미참여 시 대기 장소', '미참여시 일정'],
  descriptionText: ['내용', '설명', '선택관광 내용', '세부내용', '비고설명'],
} as const

const SHOPPING_HEADER_ALIASES = {
  shoppingItem: ['쇼핑품목', '품목', '쇼핑항목', '쇼핑 품목', '구입품목', '구매품목', '롯데 쇼핑', '롯데관광 쇼핑'],
  shoppingPlace: ['쇼핑장소', '장소', '쇼핑샵명', '쇼핑샵명(위치)', '쇼핑 장소', '매장', '센터명'],
  durationText: ['예상소요시간', '소요시간', '시간', '체류시간', '예정시간'],
  refundPolicyText: ['환불여부', '환불 가능', '교환/환불', '현지/귀국 후 환불여부', '환불정책', '교환 및 환불'],
  noteText: ['비고', '참고', '메모'],
  shoppingCountText: [
    '쇼핑 1회',
    '쇼핑횟수 총 1회',
    '총 1회 방문',
    '아래 품목 중 총 1회 쇼핑',
    '쇼핑센터 방문 1회',
    '롯데 쇼핑 횟수',
  ],
} as const
import { parseOptionalTourTableRowsFromRawText, parseShoppingStopsFromLines } from '@/lib/structured-tour-signals-lottetour'

const OPTIONAL_BANNED = /(선택경비|마일리지|적립|안내|유의사항|본\s*상품은|진행되며|합류|조인|참고|환불규정)/i
const OPTIONAL_SECTION_TITLE_ONLY = /^(선택관광|선택옵션|현지옵션|옵션투어|옵션관광)\s*$/i

function optionalCleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function optionalExtractPrice(v: string): number | null {
  const m = v.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 등록용 비정형 선택관광 섹션 (표 추출 실패 시 줄 단위 휴리스틱). */
export function parseUnstructuredOptionalTourBodyForRegister(section: string): OptionalToursStructured {
  const looksLikeOptionalTable =
    /선택관광명/i.test(section) &&
    /(선택관광\s*비용|가격|통화|소요\s*시간|소요시간|비용|동행여부|미참가|미참가시|내용|\/\s*시간\s*\/|\b시간\b)/i.test(
      section
    )
  if (looksLikeOptionalTable) {
    const tableRows = parseOptionalTourTableRowsFromRawText(section)
    if (tableRows.length > 0) {
      const rows = tableRows.map((r) => ({
        tourName: r.name,
        currency: r.currency ?? '',
        adultPrice: r.adultPrice,
        childPrice: r.childPrice,
        durationText: r.durationText ?? '',
        minPeopleText: r.minPaxText ?? '',
        guide同行Text: r.guide同行Text ?? '',
        waitingPlaceText: r.waitingPlaceText ?? '',
        descriptionText: r.raw,
        noteText: '',
      }))
      return {
        rows,
        reviewNeeded: rows.length > 0 && rows.every((r) => r.adultPrice == null && !r.currency && !r.durationText),
        reviewReasons:
          rows.length === 0
            ? ['선택관광 없음']
            : rows.every((r) => r.adultPrice == null && !r.currency && !r.durationText)
              ? ['데이터행과 설명문 구분 실패 가능']
              : [],
      }
    }
    return { rows: [], reviewNeeded: false, reviewReasons: [] }
  }

  const lines = section.split('\n').map(optionalCleanLine).filter(Boolean)
  const rows = lines
    .filter((l) => !OPTIONAL_BANNED.test(l))
    .filter((l) => {
      const hasKeyword = new RegExp(`(${OPTIONAL_HEADER_ALIASES.tourName.join('|')}|선택관광|옵션|현지옵션)`, 'i').test(l)
      const hasNumbered = /^(\d+\s*[.)-]|[①-⑳])/.test(l)
      const hasPrice = /(\$\s*[0-9][0-9,]*|USD\s*[0-9][0-9,]*|[0-9][0-9,]*\s*달러|1인\s*[0-9][0-9,]*\s*달러|[0-9][0-9,]*\s*원)/i.test(l)
      const hasDuration = /(약\s*\d+\s*시간|\d+\s*시간\s*소요|\d+\s*시간|\d+\s*분)/.test(l)
      return hasKeyword || hasNumbered || hasPrice || hasDuration
    })
    .map((l) => {
      const numbered = l.replace(/^(\d+\s*[.)-]|[①-⑳])\s*/, '')
      const oneLinePrice =
        /(.*?)(?:\s+|\(|\[)?(?:USD|\$)\s*([0-9][0-9,]*)(?:\s*\/\s*인)?/i.exec(numbered) ||
        /(.*?)(?:\s+|\(|\[)?([0-9][0-9,]*)\s*달러(?:\s*\/\s*인)?/i.exec(numbered) ||
        /(.*?)(?:\s+|\(|\[)?1인\s*([0-9][0-9,]*)\s*달러/i.exec(numbered) ||
        /(.*?)(?:\s+|\(|\[)?([0-9][0-9,]*)\s*원/i.exec(numbered)
      const tourName = oneLinePrice?.[1]?.trim() || numbered.replace(/(선택관광|현지옵션|옵션)/gi, '').trim() || numbered
      const priceFromOneLine = oneLinePrice?.[2] ? Number(oneLinePrice[2].replace(/,/g, '')) : null
      return {
        tourName,
        currency: /(USD|\$|KRW|원)/i.exec(l)?.[1]?.toUpperCase()?.replace('$', 'USD') ?? '',
        adultPrice: priceFromOneLine ?? optionalExtractPrice(l),
        childPrice: null,
        durationText: /(약\s*\d+\s*시간|\d+\s*시간\s*소요|\d+\s*시간|\d+\s*분)/.exec(l)?.[0] ?? '',
        minPeopleText: /(최소\s*\d+\s*명)/.exec(l)?.[0] ?? '',
        guide同行Text: '',
        waitingPlaceText: /(미참가시\s*대기일정|대기장소|미참여시\s*대기장소)[^,|/]*/i.exec(l)?.[0] ?? '',
        descriptionText: l,
        noteText: '',
      }
    })
    .filter((r) => {
      const tn = (r.tourName || '').replace(/\s+/g, ' ').trim()
      if (!tn || OPTIONAL_SECTION_TITLE_ONLY.test(tn)) return false
      return !!(r.currency || r.adultPrice != null || r.childPrice != null || r.durationText || r.minPeopleText || r.descriptionText)
    })
    .slice(0, 30)
  return {
    rows,
    reviewNeeded: rows.length > 0 && rows.every((r) => r.adultPrice == null && !r.currency && !r.durationText),
    reviewReasons:
      rows.length === 0
        ? []
        : rows.every((r) => r.adultPrice == null && !r.currency && !r.durationText)
          ? ['데이터행과 설명문 구분 실패 가능']
          : [],
  }
}

const SHOPPING_BANNED =
  /(쇼핑안내|쇼핑정보|소비자의\s*권리|법률|약관|헤더|환불규정\s*장문)/i

function shoppingLineLooksLikeSectionHeaderOnly(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^쇼핑\s*정보\s*안내\s*$/i.test(t)) return true
  if (/^쇼핑\s*안내\s*$/i.test(t)) return true
  if (/^쇼핑\s*정보\s*$/i.test(t)) return true
  if (/^\[?\s*쇼핑\s*\]?$/i.test(t)) return true
  if (/^(?:□|■|▶|※|\*)\s*쇼핑(?:\s*정보|\s*안내)?\s*$/i.test(t)) return true
  if (/^쇼핑\s*센터\s*$/i.test(t)) return true
  return false
}

function shoppingCleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

/** 등록용 비정형 쇼핑 섹션. */
export function parseUnstructuredShoppingBodyForRegister(section: string): ShoppingStructured {
  const tsvCandidate =
    /\t/.test(section) &&
    (/회차/i.test(section) || /^구분\t|(?:^|\n)구분\t/m.test(section)) &&
    /쇼핑\s*품목|쇼핑품목|쇼핑\s*항목|쇼핑항목/i.test(section) &&
    /쇼핑\s*장소|쇼핑장소/i.test(section)
  if (tsvCandidate) {
    const tsvLines = section.replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
    const stops = parseShoppingStopsFromLines(tsvLines)
    if (stops.length > 0) {
      const count =
        tsvLines.find((l) => /쇼핑횟수\s*총\s*\d+\s*회/i.test(l)) ??
        tsvLines.find((l) => /쇼핑\s*총?\s*\d+\s*회/.test(l)) ??
        tsvLines.find((l) => SHOPPING_HEADER_ALIASES.shoppingCountText.some((a) => l.includes(a))) ??
        ''
      const rows = stops.map((s) => ({
        shoppingItem: s.itemType,
        shoppingPlace: s.placeName,
        durationText: s.durationText ?? '',
        refundPolicyText: s.refundPolicyText ?? '',
        noteText: '',
      }))
      return {
        rows,
        shoppingCountText: count,
        reviewNeeded: rows.length > 0 && rows.every((r) => !r.shoppingItem && !r.shoppingPlace),
        reviewReasons:
          rows.length === 0
            ? []
            : rows.every((r) => !r.shoppingItem && !r.shoppingPlace)
              ? ['쇼핑 row 핵심 열 복원 실패']
              : [],
      }
    }
  }

  const lines = section.split('\n').map(shoppingCleanLine).filter(Boolean)
  const count =
    lines.find((l) => /쇼핑\s*총?\s*\d+\s*회/.test(l)) ??
    lines.find((l) => SHOPPING_HEADER_ALIASES.shoppingCountText.some((a) => l.includes(a))) ??
    ''
  const slashTable =
    /\s*[/／]\s*/.test(section) &&
    /(쇼핑품목|쇼핑항목)/i.test(section) &&
    /(쇼핑장소|환불|구분|소요)/i.test(section)
  if (slashTable) {
    const stops = parseShoppingStopsFromLines(lines)
    if (stops.length > 0) {
      const rows = stops.map((s) => ({
        shoppingItem: s.itemType,
        shoppingPlace: s.placeName,
        durationText: s.durationText ?? '',
        refundPolicyText: s.refundPolicyText ?? '',
        noteText: '',
      }))
      return {
        rows,
        shoppingCountText: count,
        reviewNeeded: rows.length > 0 && rows.every((r) => !r.shoppingItem && !r.shoppingPlace),
        reviewReasons:
          rows.length === 0
            ? []
            : rows.every((r) => !r.shoppingItem && !r.shoppingPlace)
              ? ['쇼핑 row 핵심 열 복원 실패']
              : [],
      }
    }
  }
  const rows = lines
    .filter((l) => !shoppingLineLooksLikeSectionHeaderOnly(l))
    .filter(
      (l) =>
        new RegExp(
          `(${SHOPPING_HEADER_ALIASES.shoppingItem.join('|')}|${SHOPPING_HEADER_ALIASES.shoppingPlace.join('|')}|쇼핑|환불|품목|장소)`,
          'i'
        ).test(l) &&
        (!SHOPPING_BANNED.test(l) || (/쇼핑정보/i.test(l) && /(품목|장소|소요시간|환불)/i.test(l)))
    )
    .slice(0, 20)
    .map((l) => {
      const item = /(쇼핑품목|쇼핑항목|품목)\s*[:|]?\s*([^|/]+)/i.exec(l)?.[2]?.trim() ?? l
      const place = /(쇼핑장소|장소|쇼핑샵명(?:\(위치\))?)\s*[:|]?\s*([^|/]+)/i.exec(l)?.[2]?.trim() ?? ''
      const duration = /(예상소요시간|소요시간|시간)\s*[:|]?\s*([^|/]+)/i.exec(l)?.[2]?.trim() ?? /(약\s*\d+\s*시간|\d+\s*분)/.exec(l)?.[0] ?? ''
      const refund = /(환불여부|환불 가능|교환.?환불|환불정책)\s*[:|]?\s*([^|/]+)/i.exec(l)?.[2]?.trim() ?? /(환불[^\n]*)/.exec(l)?.[1] ?? ''
      return {
        shoppingItem: item,
        shoppingPlace: place,
        durationText: duration,
        refundPolicyText: refund,
        noteText: '',
      }
    })
    .filter((r) => {
      const n = [r.shoppingItem, r.shoppingPlace, r.durationText, r.refundPolicyText].filter((x) => !!x).length
      const tooLongNarrative = `${r.shoppingItem} ${r.refundPolicyText}`.length > 160 && !r.shoppingPlace && !r.durationText
      return n >= 1 && !tooLongNarrative
    })
  return {
    rows,
    shoppingCountText: count,
    reviewNeeded: rows.length > 0 && rows.every((r) => !r.shoppingItem && !r.shoppingPlace),
    reviewReasons:
      rows.length === 0
        ? []
        : rows.every((r) => !r.shoppingItem && !r.shoppingPlace)
          ? ['쇼핑 row 핵심 열 복원 실패']
          : [],
  }
}
