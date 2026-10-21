import { describe, expect, it } from 'vitest'
import {
  extractVerygoodtourAddHotelInfoText,
  formatVerygoodtourHotelCompareLabel,
  formatVerygoodtourHotelLabelFromTextBlobs,
  parseVerygoodtourHotelInfoListHtml,
} from '@/lib/verygoodtour-hotel-info-ssot'

// REGRESSION-FREEZE[verygoodtour-hotel-info-display]: HotelInfoList·호텔설명 축약 — manifest

describe('verygoodtour hotel info display', () => {
  it('[호텔설명] 미정·준특급 → 축약', () => {
    const explain =
      '준특급 호텔에서 투숙하며, 호텔명은 미정입니다. 정확한 호텔명은 출발 1~2일 전까지 홈페이지 또는 유선을 통해 안내드립니다.'
    expect(formatVerygoodtourHotelLabelFromTextBlobs(`[호텔설명]\n- ${explain}`)).toBe(
      '준특급 출발일 1~2일전 공지',
    )
  })

  it('HotelInfoList 예정호텔명 → 동급(추후안내)', () => {
    const html = `
      <div class="hotelTourInfo">
        <p class="name"><button><span>1일차</span></button><b>도미인 치토세</b></p>
        <p class="name"><button><span>2일차</span></button><b>도미인 삿포로</b></p>
      </div>`
    const parsed = parseVerygoodtourHotelInfoListHtml(html)
    expect(parsed.names[0]).toMatch(/도미인 치토세/)
    expect(formatVerygoodtourHotelCompareLabel(parsed)).toBe('도미인 치토세 혹은 동급(추후안내)')
  })

  it('미정 only → 출발일 공지', () => {
    const html = `<p class="no_con_tx">호텔은 출발 1~2일 전까지 담당자를 통해 안내드립니다.</p>`
    const parsed = parseVerygoodtourHotelInfoListHtml(html)
    expect(formatVerygoodtourHotelCompareLabel(parsed)).toBe('출발일 1~2일전 공지')
  })

  it('addHotelInfo 추출', () => {
    const page = `addHotelInfo = '- 준특급 호텔에서 투숙하며, 호텔명은 미정입니다.&lt;br /&gt;정확한 호텔명은 출발 1~2일 전까지 안내드립니다.'.replace(/&lt;/g, "<");`
    const t = extractVerygoodtourAddHotelInfoText(page)
    expect(t).toMatch(/준특급/)
    expect(formatVerygoodtourHotelLabelFromTextBlobs(t)).toBe('준특급 출발일 1~2일전 공지')
  })
})
