import { describe, expect, it } from 'vitest'
import { buildNaeiltourFlightStructuredFromHtml } from '@/lib/naeiltour-register-api-detail'

/** 상단 메가메뉴에 '카타르' 링크가 있는 실제 내일투어 구조(요약) — 10/31 '카타르' 오저장 재현용 */
const MEGA_MENU = `<div class="cnt"><dl class="list"><dd><a href="/tour/search/search_list.asp?keyword=아부다비"><span>아부다비</span></a></dd><dd><a href="/tour/search/search_list.asp?keyword=카타르"><span>카타르</span></a></dd></dl></div>`

const AIRLINE_BLOCK_AF = `<div class="airline-time"> <div class="airline"> <p class="btxt">항공사</p> <p class="stxt-btn"> <span class="stxt"><i class="icon"><img src="/friday/program/images/AF.gif" style="vertical-align:middle;" /></i>에어프랑스</span> <!-- <a href="#n" class="btn pop-flight"><span>항공 여정 보기</span></a> --> </p> </div> <div class="depar"> <p class="btxt">일정</p> <p class="stxt"><strong>2026년 11월 02일(월)</strong>[10:50~22:50] - AF267</p> <p class="stxt"><strong>2026년 11월 07일(토)</strong>[09:05~08:40] - AF264</p> </div></div>`

const DEPAR_ONLY = (fn1: string, fn2: string) =>
  `<div class="depar"> <p class="btxt">일정</p> <p class="stxt"><strong>2026년 09월 08일(화)</strong>[08:00~10:20] - ${fn1}</p> <p class="stxt"><strong>2026년 09월 11일(금)</strong>[11:30~15:00] - ${fn2}</p> </div>`

describe('내일투어 항공사 — 항공 구역 + IATA 접두 (10/31 카타르 버그)', () => {
  it('airline 블록 이름에 "항공"이 없어도(에어프랑스) 메뉴의 카타르를 잡지 않는다', () => {
    const fs = buildNaeiltourFlightStructuredFromHtml(MEGA_MENU + AIRLINE_BLOCK_AF, null, null)
    expect(fs?.airlineName).toBe('에어프랑스')
    expect(fs?.outbound.flightNo).toBe('AF267')
  })
  it("편명 'AF267'만 있는 원문 → 에어프랑스", () => {
    const fs = buildNaeiltourFlightStructuredFromHtml(MEGA_MENU + DEPAR_ONLY('AF267', 'AF264'), null, null)
    expect(fs?.airlineName).toBe('에어프랑스')
  })
  it("편명 'RS101'만 있는 원문 → 에어서울", () => {
    const fs = buildNaeiltourFlightStructuredFromHtml(MEGA_MENU + DEPAR_ONLY('RS101', 'RS102'), null, null)
    expect(fs?.airlineName).toBe('에어서울')
  })
  it('편명 LJ·HX·UO 도 접두로 판별', () => {
    expect(buildNaeiltourFlightStructuredFromHtml(MEGA_MENU + DEPAR_ONLY('LJ261', 'LJ272'), null, null)?.airlineName).toBe('진에어')
    expect(buildNaeiltourFlightStructuredFromHtml(DEPAR_ONLY('HX627', 'HX628'), null, null)?.airlineName).toBe('홍콩항공')
    expect(buildNaeiltourFlightStructuredFromHtml(DEPAR_ONLY('UO657', 'UO656'), null, null)?.airlineName).toBe('홍콩익스프레스')
  })
  it('블록 이름이 편명 코드와 어긋나면 편명 코드 항공사', () => {
    const html = AIRLINE_BLOCK_AF.replace('에어프랑스', '카타르')
    expect(buildNaeiltourFlightStructuredFromHtml(html, null, null)?.airlineName).toBe('에어프랑스')
  })
  it('블록 이름과 편명 코드가 같으면 공급사 원문 표기 그대로 (홍콩에어라인/HX)', () => {
    const html = AIRLINE_BLOCK_AF.replace('AF.gif', 'HX.gif').replace('에어프랑스', '홍콩에어라인').replace(/AF26/g, 'HX62')
    expect(buildNaeiltourFlightStructuredFromHtml(html, null, null)?.airlineName).toBe('홍콩에어라인')
  })
  it('항공 정보가 아예 없으면 메뉴 단어로 항공사를 만들지 않는다', () => {
    const fs = buildNaeiltourFlightStructuredFromHtml(MEGA_MENU + '<p>일정 안내</p>', null, null)
    expect(fs?.airlineName ?? null).toBeNull()
  })
})
