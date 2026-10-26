import { describe, expect, it } from 'vitest'
import {
  sanitizeIncludedExcludedItemsLines,
  stripIncludedExcludedHtmlDebris,
} from '@/lib/included-excluded-postprocess'
import { splitIncludedExcludedForPublicDisplay } from '@/lib/product-included-excluded-public'

describe('include/exclude HTML sanitize', () => {
  it('strips VG/YB-style tags at parse helper', () => {
    expect(stripIncludedExcludedHtmlDebris('<p>항공권</p><br/>가이드')).toMatch(/항공권/)
    expect(stripIncludedExcludedHtmlDebris('<p>항공권</p>')).not.toMatch(/</)
    expect(
      sanitizeIncludedExcludedItemsLines(['<li>호텔 3박</li>', '<script>x</script>가이드비']),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/호텔/)]))
  })

  it('public display split strips leftover HTML', () => {
    const r = splitIncludedExcludedForPublicDisplay(
      '<p>왕복항공권</p><br>호텔 3박',
      '<div>여행자보험</div>',
    )
    expect(r.includedLines.join(' ')).not.toMatch(/</)
    expect(r.includedLines.some((l) => /항공|호텔/.test(l))).toBe(true)
    expect(r.excludedLines.join(' ')).not.toMatch(/</)
  })
})
