/**
 * 모두투어(modetour) 관리자 등록 — **본문 축** 스냅샷만 조립한다.
 *
 * 담당: 정규화, 섹션 앵커·슬라이스, 호텔 전처리·표 구조화, 포함/불포함(클립·경계), `raw.flightRaw` 등 원료.
 * 일정 배열·항공 directed leg는 여기서 다루지 않는다.
 *
 * **비담당(SSOT = 입력 파서):** 항공·선택관광·쇼핑 구조화 — `register-input-parse-modetour` + `register-parse-modetour`.
 * 항공·가격·공개 병합 계약: `docs/ops/modetour-parse-contract.md`.
 *
 * @see docs/body-parser-modetour-ssot.md
 *
 * 상위 등록 규약: `docs/admin-register-supplier-precise-spec.md` §1. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import type { DetailBodyParseSnapshot, HotelStructured } from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import {
  normalizeDetailRawText,
  splitDetailSections,
  sliceDetailBodySections,
} from '@/lib/detail-body-parser-utils-modetour'
import { parseModetourIncludedExcludedSection } from '@/lib/modetour-basic-info-must-know-extract'
import { parseHotelSectionGeneric } from '@/lib/hotel-table-parser-modetour'
import { buildDetailReviewPolicyModetour } from '@/lib/review-policy-modetour'

/** 날짜만으로는 플러시하지 않음(일차·도시·예정 줄만 있을 때 호텔 후보 `-` 줄 전까지 이어 붙임) */
const MODETOUR_HOTEL_ROW_COMPLETE =
  /(호텔|리조트|숙소|콘도|미정|예정|확정|동급|예약\s*완료|THE\s+[A-Z]{2,}|\bINN\b|타워|팰리스|플라자|그랜드|웨스틴|하얏트|힐튼|메리어트|코트야드|셰라톤|라디슨|노보텔|이비스|한화리조트|\[[^\]]{2,80}\]|^-\s)/i

/** 일차·날짜·도시·호텔명이 줄바꿈으로 쪼개진 모두투어 표를 한 행으로 이어 붙임 */
function preprocessModetourHotelSection(section: string): string {
  const lines = section.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const merged: string[] = []
  let acc = ''
  const flush = () => {
    if (acc.trim()) merged.push(acc.trim())
    acc = ''
  }
  const accIsDayOnly = () => /^\d{1,2}\s*일차\.?$/i.test(acc.trim())
  for (const l of lines) {
    if (/^-\s/.test(l) && acc.trim() && /\d{1,2}\s*일차/i.test(acc) && !/^-\s/.test(acc.trim())) {
      flush()
      acc = l
      continue
    }
    const isNewDay = /^\d{1,2}\s*일차\b/i.test(l)
    if (isNewDay && acc) {
      if (accIsDayOnly()) acc = ''
      else flush()
    }
    if (isNewDay) {
      acc = acc ? `${acc} ${l}` : l
      continue
    }
    if (!acc) {
      acc = l
      continue
    }
    acc = `${acc} ${l}`
    const hasDay = /\d{1,2}\s*일차/i.test(acc)
    const looksNamed =
      hasDay &&
      acc.length > 28 &&
      /[가-힣]{3,}/.test(acc) &&
      (MODETOUR_HOTEL_ROW_COMPLETE.test(acc) || /[가-힣]{2,8}\s+[가-힣A-Za-z·\s]{4,}/.test(acc))
    if (MODETOUR_HOTEL_ROW_COMPLETE.test(acc) || looksNamed || acc.length > 220) {
      flush()
    }
  }
  flush()
  return merged.join('\n')
}

const MODETOUR_CITY_HINT =
  /(서울|부산|제주|인천|대구|대전|광주|울산|수원|성남|고양|용인|청주|전주|포항|창원|강릉|속초|양양|태안|보령|목포|여수|경주|통영|거제|하노이|호치민|다낭|방콕|파타야|치앙마이|프놈펜|세부|마닐라|보홀|클락|발리|자카르타|싱가포르|쿠알라룸푸르|오사카|고베|교토|나고야|후쿠오카|삿포로|도쿄|요코하마|타이페이|홍콩|마카오|상하이|베이징|북경|시안|청두|청도|장가계|구이린|황산|연길|장춘|하얼빈|모스크바|상트페테르부르크|파리|니스|로마|밀라노|바르셀로나|마드리드|뮌헨|프랑크푸르트|런던|뉴욕|로스앤젤레스|호놀룰루|시드니|멜버른)/u

function enrichModetourHotelStructured(base: HotelStructured): HotelStructured {
  const rows = base.rows
    .map((r) => {
      let cityText = r.cityText?.trim() ?? ''
      let dateText = r.dateText?.trim() ?? ''
      let hotelNameText = r.hotelNameText
      const combined = `${r.dayLabel ?? ''} ${r.dateText ?? ''} ${r.cityText ?? ''} ${r.hotelNameText}`.replace(/\s+/g, ' ').trim()
      const mTrip =
        /^(\d{1,2}\s*일차)\s+(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\s+(.+)$/i.exec(
          combined
        )
      if (mTrip?.[1] && mTrip[2] && mTrip[3]) {
        const rest = mTrip[3]!.trim()
        const cityHit = rest.match(MODETOUR_CITY_HINT)
        if (cityHit?.[1]) {
          if (!cityText) cityText = cityHit[1]!
          if (!dateText) dateText = mTrip[2]!
          const afterCity = rest.slice(rest.indexOf(cityHit[1]!) + cityHit[1]!.length).trim()
          if (afterCity && (hotelNameText.trim() === r.dayLabel?.trim() || hotelNameText.length < 8))
            hotelNameText = afterCity
        }
      }
      const hay = `${hotelNameText} ${r.noteText ?? ''}`
      const cm = hay.match(MODETOUR_CITY_HINT)
      if (!cityText && cm) cityText = cm[1]!
      if (!dateText.trim()) {
        const dm = hay.match(/(\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}|\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{2,4})/)
        if (dm?.[1]) dateText = dm[1]!.replace(/\s+/g, '')
      }
      if (!cityText.trim() && hotelNameText.length > 14) {
        const tm = /^([가-힣]{2,8})\s+([가-힣A-Za-z0-9·\s]{6,90})$/i.exec(hotelNameText.trim())
        if (
          tm?.[1] &&
          tm[2] &&
          /(호텔|리조트|타워|팰리스|그랜드|웨스틴|하얏트|힐튼|조선|신라|콘래드|페닌슐라|노보텔|셰라톤)/i.test(
            tm[2]
          )
        ) {
          cityText = tm[1]!.trim()
          hotelNameText = tm[2]!.trim()
        }
      }
      let bookingStatusText = r.bookingStatusText?.trim() ?? ''
      if (!bookingStatusText) {
        const bm = hay.match(/(예약\s*완료|예약\s*가능|확정\s*예약|미확정|미정|확정|동급\s*숙박)/)
        if (bm?.[1]) bookingStatusText = bm[1]!
      }
      const dl = r.dayLabel?.trim() ?? ''
      if (dl && hotelNameText.trim() === dl && r.hotelCandidates.length) {
        const best = r.hotelCandidates.find((c) => /(호텔|리조트|숙소|콘도|동급)/i.test(c)) ?? r.hotelCandidates[0]
        if (best?.trim()) hotelNameText = best.trim()
      }
      return {
        ...r,
        cityText,
        dateText: dateText || r.dateText,
        hotelNameText,
        bookingStatusText: bookingStatusText || r.bookingStatusText,
      }
    })
    .filter((r) => {
      const t = r.hotelNameText.trim()
      const dl = r.dayLabel.trim()
      if (!dl) return true
      if (t === dl || t === `${dl}.`) return false
      if (t.length < 14 && /^[\d\s일차.]+$/u.test(t)) return false
      return true
    })

  const finalRows = rows.length > 0 ? rows : base.rows
  return {
    rows: finalRows,
    reviewNeeded: finalRows.length === 0,
    reviewReasons:
      finalRows.length === 0
        ? ['호텔 섹션이 있으나 row 복원 실패']
        : base.reviewReasons.length
          ? base.reviewReasons
          : finalRows.some((r) => r.hotelCandidates.length > 1)
            ? ['호텔명 후보 다수']
            : [],
  }
}

function parseHotelSectionModetour(section: string): HotelStructured {
  const pre = preprocessModetourHotelSection(section)
  const base = parseHotelSectionGeneric(pre)
  return enrichModetourHotelStructured(base)
}

/** 포함/불포함 파싱 전에 무비자·유의·미팅·선택관광 표 머리 등 이후를 잘라 낸다(SSOT: `docs/body-parser-modetour-ssot.md`). */
function clipModetourIncExcInputForParse(blob: string): string {
  const lines = blob.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (/^예약\s*시\s*유의\s*사항/i.test(t)) break
    if (/^여행\s*시\s*유의\s*사항/i.test(t)) break
    if (/^미팅정보/i.test(t)) break
    if (/^여행\s*상세\s*정보/i.test(t)) break
    if (/^#\s*선택옵션/i.test(t)) break
    if (/^선택관광명/i.test(t)) break
    if (/^▶\s*이민국\s*신청/i.test(t)) break
    if (/^■\s*중국\s*온라인\s*입국/i.test(t)) break
    if (/온라인\s*입국신고서.*의무/i.test(t)) break
    if (
      /입국일\s*기준\s*90일/i.test(t) &&
      /(중국|무비자|온라인\s*입국|입국신고|e\s*arrival)/i.test(t) &&
      t.length < 160
    )
      break
    out.push(line)
  }
  return out.join('\n').trim()
}

export function parseDetailBodyStructuredModetour(input: {
  rawText: string
  hotelRaw?: string | null
  optionalRaw?: string | null
  shoppingRaw?: string | null
}): DetailBodyParseSnapshot {
  const normalizedRaw = normalizeDetailRawText(input.rawText)
  const sections = splitDetailSections(normalizedRaw)
  const { flightSection, hotelSection, optionalSection, shoppingSection, incExcSection } =
    sliceDetailBodySections(normalizedRaw, sections, {
      hotelRaw: input.hotelRaw,
      optionalRaw: input.optionalRaw,
      shoppingRaw: input.shoppingRaw,
    })

  const flightStructured = emptyFlightStructured()
  const hotelStructured = parseHotelSectionModetour(hotelSection)
  const optionalToursStructured = emptyOptionalToursStructured()
  const shoppingStructured = emptyShoppingStructured()
  const incExcForParse = clipModetourIncExcInputForParse(incExcSection)
  let includedExcludedStructured = parseModetourIncludedExcludedSection(incExcForParse)
  if (
    includedExcludedStructured.includedItems.length === 0 &&
    includedExcludedStructured.excludedItems.length === 0 &&
    /포함\s*사항/i.test(normalizedRaw) &&
    /불포함\s*사항/i.test(normalizedRaw)
  ) {
    includedExcludedStructured = parseModetourIncludedExcludedSection(
      clipModetourIncExcInputForParse(normalizedRaw)
    )
  }

  const { review, sectionReview, qualityScores, failurePatterns } = buildDetailReviewPolicyModetour({
    sections,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    optionalPasteRaw: input.optionalRaw?.trim() || null,
    shoppingPasteRaw: input.shoppingRaw?.trim() || null,
  })

  return {
    normalizedRaw,
    sections,
    review,
    sectionReview,
    qualityScores,
    failurePatterns,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    brandKey: 'modetour',
    raw: {
      hotelPasteRaw: input.hotelRaw?.trim() || null,
      optionalToursPasteRaw: input.optionalRaw?.trim() || null,
      shoppingPasteRaw: input.shoppingRaw?.trim() || null,
      flightRaw: flightSection.trim() || null,
    },
  }
}
