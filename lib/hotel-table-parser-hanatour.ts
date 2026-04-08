import type { HotelStructured } from '@/lib/detail-body-parser-types'

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

/** 하나투어 전용 — 호텔 섹션 표·서술에서 행 복원 */
export function parseHotelSectionGeneric(section: string): HotelStructured {
  const lines = section.split('\n').map(cleanLine).filter(Boolean)
  const splitCandidates = (v: string): string[] =>
    v
      .split(/\/|,|•|- |\n/)
      .map((x) => x.trim())
      .filter(Boolean)
  const rows = lines
    .filter(
      (l) =>
        /(호텔|숙소|리조트)/i.test(l) &&
        !/(조식|중식|석식|유의사항|안내문)/i.test(l) &&
        !/예정호텔[은는이가]\b/i.test(l)
    )
    .slice(0, 30)
    .map((l) => {
      const hotelCandidates = splitCandidates(l).filter((x) => /(호텔|리조트|숙소|콘도)/i.test(x))
      const dayLabel = /([0-9]{1,2}\s*일차|day\s*[0-9]{1,2})/i.exec(l)?.[1] ?? ''
      const dateText = /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}\/\d{1,2})/.exec(l)?.[1] ?? ''
      const bookingStatusText = /(예정|미정|확정|대기)/.exec(l)?.[1] ?? ''
      const cityText = /(인천|김포|부산|제주|도쿄|오사카|연길|베이징|상해|다낭|방콕|파리|로마)/.exec(l)?.[1] ?? ''
      return {
        dayLabel,
        dateText,
        cityText,
        bookingStatusText,
        hotelNameText: l,
        hotelCandidates: hotelCandidates.length > 0 ? hotelCandidates : [l],
        noteText: '',
      }
    })
    .filter((r) => {
      const fields = [r.dayLabel, r.dateText, r.cityText, r.bookingStatusText, r.hotelNameText].filter((x) => x).length
      return fields >= 2
    })
  if (rows.length === 0) {
    const scheduleFallback = lines
      .filter(
        (l) =>
          /([0-9]{1,2}\s*일차|day\s*[0-9]{1,2}|예정호텔|숙박|투숙|숙소|호텔명|호텔:|숙소:)/i.test(l) &&
          !/예정호텔[은는이가]\b/i.test(l)
      )
      .map((l) => ({
        dayLabel: /([0-9]{1,2}\s*일차|day\s*[0-9]{1,2})/i.exec(l)?.[1] ?? '',
        dateText: /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2})/.exec(l)?.[1] ?? '',
        cityText: /(인천|김포|부산|제주|도쿄|오사카|연길|베이징|상해|다낭|방콕|파리|로마)/.exec(l)?.[1] ?? '',
        bookingStatusText: /(예정|미정|확정|대기)/.exec(l)?.[1] ?? '',
        hotelNameText: l,
        hotelCandidates: splitCandidates(l),
        noteText: /(예정호텔\s*외\s*\d+개|미정|동급호텔)/i.exec(l)?.[0] ?? '',
      }))
    rows.push(...scheduleFallback)
  }
  if (rows.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (
        !/(숙박|투숙|예정호텔|호텔명|호텔:|숙소:)/i.test(line) ||
        /예정호텔[은는이가]\b/i.test(line)
      )
        continue
      const prev = lines[i - 1] ?? ''
      const next = lines[i + 1] ?? ''
      const merged = `${prev} ${line} ${next}`.trim()
      const dayLabel = /([0-9]{1,2}\s*일차|day\s*[0-9]{1,2})/i.exec(merged)?.[1] ?? ''
      const dateText = /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2})/.exec(merged)?.[1] ?? ''
      const cityText = /(인천|김포|부산|제주|도쿄|오사카|연길|베이징|상해|다낭|방콕|파리|로마)/.exec(merged)?.[1] ?? ''
      const hotelCandidates = splitCandidates(merged).filter((x) => /(호텔|리조트|숙소|콘도|동급호텔)/i.test(x))
      if (hotelCandidates.length === 0) continue
      rows.push({
        dayLabel,
        dateText,
        cityText,
        bookingStatusText: /(예정|미정|확정|대기)/.exec(merged)?.[1] ?? '',
        hotelNameText: line,
        hotelCandidates,
        noteText: /(예정호텔\s*외\s*\d+개|미정|동급호텔)/i.exec(merged)?.[0] ?? '',
      })
    }
  }
  return {
    rows,
    reviewNeeded: rows.length === 0,
    reviewReasons:
      rows.length === 0
        ? ['호텔 섹션이 있으나 row 복원 실패']
        : rows.some((r) => r.hotelCandidates.length > 1)
          ? ['호텔명 후보 다수']
          : [],
  }
}
