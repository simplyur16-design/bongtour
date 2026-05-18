/**
 * 일정 `imageKeyword`: Pexels 검색용 영문 관광지·랜드마크 고유명 1개.
 */

import { extractPlaceNameKeyword } from '@/lib/pexels-place-name-keyword'

export { extractPrimaryEnglishPlaceName } from '@/lib/english-schedule-place-extract'

/** @deprecated 이름 유지(호출부 호환). 삼단 포맷 대신 장소명만 반환한다. */
export function buildEnglishPlaceTripartiteImageKeyword(opts: {
  title: string
  description: string
  rawDayBody: string
  currentKeyword?: string
}): string {
  return extractPlaceNameKeyword({
    llmImageKeyword: opts.currentKeyword,
    title: opts.title,
    description: opts.description,
    rawBody: opts.rawDayBody,
  })
}

export function buildEnglishPlaceNameImageKeyword(opts: {
  title: string
  description: string
  rawDayBody: string
  currentKeyword?: string
  cityEn?: string
  countryEn?: string
}): string {
  return extractPlaceNameKeyword({
    llmImageKeyword: opts.currentKeyword,
    title: opts.title,
    description: opts.description,
    rawBody: opts.rawDayBody,
    cityEn: opts.cityEn,
    countryEn: opts.countryEn,
  })
}
