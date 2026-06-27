import { describe, expect, it } from 'vitest'
import {
  extractVerygoodOptionalShoppingFromDetailHtml,
  parseVerygoodBookingMetaFromDetailHtml,
} from '@/lib/verygoodtour-register-api-detail'

const OPTIONAL_TABLE_HTML = `
<table>
<caption class="caption_hide">선택관광리스트</caption>
<thead>
<tr><th>번호</th><th>선택<br>관광명</th><th>내용</th><th>비용</th><th>시간</th><th>대기일정</th><th>대기장소</th><th>동행여부</th></tr>
</thead>
<tbody>
<tr>
<td class="td0">1</td>
<td>말라카퍼펙트투어</td>
<td>트라이쇼+리버보트+스카이타워</td>
<td>$80</td>
<td>약1시간30분</td>
<td>주변지역 대기, 차량대기</td>
<td>외부</td>
<td>미동행</td>
</tr>
<tr>
<td class="td0">2</td>
<td>쿠알라나이트투어</td>
<td>야시장+열대과일시식+마사지1시간</td>
<td>$70</td>
<td>약2시간</td>
<td>주변지역 대기, 차량대기</td>
<td>외부</td>
<td>미동행</td>
</tr>
</tbody>
</table>
<table>
<caption class="caption_hide">쇼핑안내리스트</caption>
<thead>
<tr><th>구분</th><th>쇼핑항목</th><th>쇼핑장소</th><th>소요시간</th><th>환불여부</th></tr>
</thead>
<tbody>
<tr>
<td>1</td>
<td>통캇알리,노니오일,커피 등</td>
<td>잡화점(쿠알라룸푸르)</td>
<td>약40분~1시간</td>
<td>조건부가능</td>
</tr>
<tr>
<td>2</td>
<td>커피,말린과일,과자,악세서리 등</td>
<td>토산품점</td>
<td>약40분~1시간</td>
<td>조건부가능</td>
</tr>
</tbody>
</table>
<p>쇼핑횟수 총 2회</p>
`

describe('verygoodtour-register-api-detail opt/shop table SSOT', () => {
  it('parses 선택관광리스트·쇼핑안내리스트 caption tables from PackageDetail HTML', () => {
    const r = extractVerygoodOptionalShoppingFromDetailHtml(OPTIONAL_TABLE_HTML)
    expect(r.hasOptionalTour).toBe(true)
    expect(r.optionalTourCount).toBe(2)
    const optRows = JSON.parse(r.optionalToursStructured ?? '[]') as Array<{ name: string; adultPrice: number }>
    expect(optRows.map((x) => x.name)).toEqual(['말라카퍼펙트투어', '쿠알라나이트투어'])
    expect(optRows[0]?.adultPrice).toBe(80)

    expect(r.shoppingVisitCount).toBe(2)
    const shopRows = JSON.parse(r.shoppingStops ?? '[]') as Array<{ itemType: string; placeName: string }>
    expect(shopRows.length).toBe(2)
    expect(shopRows[0]?.placeName).toMatch(/쿠알라룸푸르/)
  })

  it('parseVerygoodBookingMetaFromDetailHtml reads 예약현황 fc_sky spans + braze json', () => {
    const html = `
      <div class="detail-info detail-info-1">
        <h4 class="detail-h">예약현황</h4>
        <p class="current">현재예약 <span class="fc_sky">0</span> 명</p>
        <p class="minimum">최소출발 <span class="fc_sky">4</span> 명</p>
      </div>
      {
        "current_booking_count": 0,
        "minimum_booking_count": 4,
        "booking_status": "예약가능"
      };
    `
    expect(parseVerygoodBookingMetaFromDetailHtml(html)).toMatchObject({
      currentBookedCount: 0,
      minimumDepartureCount: 4,
      remainingSeatsCount: null,
      departureStatusText: '현재예약 0명 · 최소출발 4명',
    })
  })
})
