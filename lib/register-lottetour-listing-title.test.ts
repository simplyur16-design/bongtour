/**
 * REGRESSION-FREEZE[lottetour-register-listing-title]
 */
import { describe, expect, it } from 'vitest'
import {
  extractLottetourListingTitleFromHtml,
  extractLottetourVerbatimListingTitle,
  isLottetourBracketListingTitleLine,
} from '@/lib/register-lottetour-basic'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

const B41A_TITLE =
  '[KE][NO옵션][ALL STAY POOL VILLA]푸꾸옥 5일▶[멜리아 빈펄 푸꾸옥(풀빌라)]'

describe('lottetour bracket listing title', () => {
  it('accepts B41A-style bracket title without #', () => {
    expect(isLottetourBracketListingTitleLine(B41A_TITLE)).toBe(true)
    expect(isSupplierListingTitleUnacceptable(B41A_TITLE, 'lottetour')).toBe(false)
  })

  it('extracts from paste window without 상품번호', () => {
    const paste = ['핵심정보', B41A_TITLE, '여행일정', '07/20 (월) 19:05 출발'].join('\n')
    expect(extractLottetourVerbatimListingTitle(paste)).toBe(B41A_TITLE)
  })

  it('extracts from basicAjax-like HTML when evtList tourTitleRaw empty', () => {
    const html = `
      <div class="title_area">
        <h3>${B41A_TITLE}</h3>
        <p>푸꾸옥의 대표 해양 액티비티</p>
      </div>
    `
    expect(extractLottetourListingTitleFromHtml(html)).toBe(B41A_TITLE)
  })

  it('rejects short duration-only lines', () => {
    expect(isLottetourBracketListingTitleLine('3박 5일')).toBe(false)
    expect(isLottetourBracketListingTitleLine('[KE] 출발')).toBe(false)
  })
})
