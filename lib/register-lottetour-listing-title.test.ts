/**
 * REGRESSION-FREEZE[lottetour-register-listing-title]
 */
import { describe, expect, it } from 'vitest'
import {
  carveLottetourListingTitleFromText,
  extractLottetourListingTitleFromHtml,
  extractLottetourVerbatimListingTitle,
  isLottetourBracketListingTitleLine,
} from '@/lib/register-lottetour-basic'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

const B41A_TITLE =
  '[KE][NO옵션][ALL STAY POOL VILLA]푸꾸옥 5일▶[멜리아 빈펄 푸꾸옥(풀빌라)]'

const G03A_TITLE =
  '★출발확정★【KE/11일】【인솔자동행/NO옵션】호주 시드니&뉴질랜드 남북섬 완전일주#시드니 5성급 #4大트레킹 #밀포드사운드 #포트스테판'

describe('lottetour bracket listing title', () => {
  it('accepts B41A-style bracket title without #', () => {
    expect(isLottetourBracketListingTitleLine(B41A_TITLE)).toBe(true)
    expect(isSupplierListingTitleUnacceptable(B41A_TITLE, 'lottetour')).toBe(false)
  })

  it('accepts ★출발확정★【KE/N일】#태그 oceania title', () => {
    expect(isLottetourBracketListingTitleLine(G03A_TITLE)).toBe(true)
    expect(isSupplierListingTitleUnacceptable(G03A_TITLE, 'lottetour')).toBe(false)
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

  it('carves G03A title from glued evtDetail hero line with marketing tail', () => {
    const glued =
      '출발확정 ' +
      G03A_TITLE +
      ' 고객만족 BEST !! 대양주지역 판매 1위 여행상품.'
    expect(carveLottetourListingTitleFromText(glued)).toBe(G03A_TITLE)
    expect(extractLottetourVerbatimListingTitle(glued)).toBe(G03A_TITLE)
    expect(extractLottetourListingTitleFromHtml(`<h3>${glued}</h3>`)).toBe(G03A_TITLE)
  })

  it('rejects short duration-only lines', () => {
    expect(isLottetourBracketListingTitleLine('3박 5일')).toBe(false)
    expect(isLottetourBracketListingTitleLine('[KE] 출발')).toBe(false)
  })
})
