import { describe, expect, it } from 'vitest'
import {
  isModetourDepartureWindowOnlyTitleText,
  isModetourUnacceptableRegisterListingTitle,
  modetourBaselineAcceptableForConfirm,
} from '@/lib/modetour-departures'
import { extractModetourVerbatimListingTitleRawFromPaste } from '@/lib/modetour-listing-title-from-paste'

const GOOD_TITLE =
  '[다낭] #바나힐 #호이안 #미케비치 #전신마사지 60분 #노쇼핑 #노옵션 3박 4일'

describe('modetour listing title from paste', () => {
  it('rejects departure window line as product title', () => {
    expect(isModetourDepartureWindowOnlyTitleText('2026.12.12~2026.12.14 2박 3일')).toBe(true)
    expect(isModetourUnacceptableRegisterListingTitle('2026.12.12~2026.12.14 2박 3일')).toBe(true)
  })

  it('accepts real listing title signals', () => {
    expect(isModetourUnacceptableRegisterListingTitle(GOOD_TITLE)).toBe(false)
    expect(
      modetourBaselineAcceptableForConfirm({
        pickedSource: 'h1.product_tit',
        raw: GOOD_TITLE,
        cleaned: GOOD_TITLE,
      })
    ).toBe(true)
  })

  it('picks hash title over departure window in paste head', () => {
    const paste = `2026.12.12~2026.12.14 2박 3일
${GOOD_TITLE}
여행 일정
1일차`
    expect(extractModetourVerbatimListingTitleRawFromPaste(paste)).toBe(GOOD_TITLE)
  })

  it('does not return departure window when it is the only tour-shaped line', () => {
    const paste = `2026.12.12~2026.12.14 2박 3일
3박 4일
이스타항공
여행 일정`
    expect(extractModetourVerbatimListingTitleRawFromPaste(paste)).toBeNull()
  })
})
