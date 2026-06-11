import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseFlightSectionLottetour } from '../lib/flight-parser-lottetour'
import { parseLottetourIncludedExcludedSection } from '../lib/register-lottetour-basic'
import { parseLottetourShoppingPasteTab } from '../lib/register-lottetour-shopping'
import { extractMinimumDepartureMeta } from '../lib/minimum-departure-extract'

const FLIGHT_PASTE = `한국
출발
KE95506/26 (금) 13:40
인천국제공항 출발06/26(금) 19:40
이스탄불 도착
한국
도착
KE95607/03 (금) 21:20
이스탄불 출발07/03(금) 21:20
인천국제공항 도착07/04(토) 13:25`

const SHOPPING_PASTE = `구분\t쇼핑품목\t쇼핑장소\t소요시간\t환불여부
1\t터키석, 술탄라이트, 금&은 제품 등\t터키석 샵, 카파도키아\t40분~1시간 소요\tN
2\t프로폴리스, 천연 영양제 등\t비타민 샵, 안탈리아\t40분~1시간 소요\tN
3\t면 의류, 면&오리털 이불, 여름 이불 등\t면제품 샵, 파묵칼레\t40분~1시간 소요\tN
4\t양가죽 의류, 벨트, 가방 등\t양가죽 샵, 에페소\t40분~1시간 소요\tN
5\t장미 오일, 엑스트라 버진, 월계수 비누 등\t선물 코너, 이스탄불\t40분~1시간 소요\tN
6\t실크, 면, 앙고라 카펫 등\t카펫 샵, 이스탄불\t40분~1시간 소요\tN`

const INCLUDE_EXCLUDE = `포함사항
▣ 대한항공 왕복 항공료 (일반석)
▣ 관광지 입장료
불포함사항
▣ 인솔자/가이드/기사경비: 전 일정 EUR€90`

describe('lottetour register preview warnings — Turkey paste', () => {
  it('parses compact flight paste (KE955/KE956)', () => {
    const fs = parseFlightSectionLottetour(FLIGHT_PASTE, `2026 여행 대한항공 KE955`)
    assert.equal(fs.debug?.status !== 'failure', true, fs.debug?.status)
    assert.equal(fs.outbound.flightNo, 'KE955')
    assert.equal(fs.inbound.flightNo, 'KE956')
    assert.match(fs.airlineName ?? '', /대한항공/)
    assert.equal(fs.reviewNeeded, false)
  })

  it('parses shopping table with 구분 header (6 rows)', () => {
    const shop = parseLottetourShoppingPasteTab(SHOPPING_PASTE)
    assert.ok(shop)
    assert.equal(shop!.rows.length, 6)
    assert.equal(shop!.shoppingCountText, '쇼핑 6회')
  })

  it('parses include/exclude with ▣ bullets', () => {
    const ie = parseLottetourIncludedExcludedSection(INCLUDE_EXCLUDE)
    assert.equal(ie.reviewNeeded, false)
    assert.ok(ie.includedItems.length >= 2)
    assert.ok(ie.excludedItems.length >= 1)
  })

  it('extracts minimum departure 성인 20명', () => {
    const blob = '출발확정 예약 22명 / 총 24석 남은좌석 2석 (최소출발 성인 20명) 보기'
    const sig = extractMinimumDepartureMeta(blob)
    assert.equal(sig.minimumDepartureCount, 20)
    assert.equal(
      sig.fieldIssues.some((f) => f.field === 'minimumDepartureCount'),
      false,
    )
  })
})
