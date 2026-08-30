/**
 * REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]
 */
import { describe, expect, it } from 'vitest'
import { naeiltourDetailHtmlLooksUnsellable } from '@/lib/naeiltour-register-api-detail'

describe('naeiltourDetailHtmlLooksUnsellable', () => {
  it('판매가 되지 않는 상품 alert는 수집 대상이 아니다', () => {
    expect(
      naeiltourDetailHtmlLooksUnsellable(
        '<script type="text/javascript">alert("판매가 되지 않는 상품입니다.");location.href="/";</script>',
      ),
    ).toBe(true)
  })

  it('정상 상세 HTML은 판매불가가 아니다', () => {
    expect(
      naeiltourDetailHtmlLooksUnsellable(
        '<html><head><title>유럽 패키지 8일</title></head><body><h2 class="tit">로마 바티칸</h2></body></html>',
      ),
    ).toBe(false)
  })
})
