import { HANJINTOUR_SITE_CD, HANJINTOUR_SITE_NO, type HanjintourClient } from '@/lib/hanjintour-http'

/**
 * 한진관광 공개 화면 JSON API (비로그인). 경로·파라미터는 공개 화면 스크립트(DisplayService·GnbMenuService)와 같다.
 * - 메뉴(지역 분류): GET  /api/v1/main/gnb-menu/{siteNo}
 * - 목록:            POST /api/v1/dp/display            (dspCtgNo, startDate~endDate, start/size)
 * - 출발일 달력:      POST /api/v1/dp/display/calendar   (gdsNo, startDate~endDate)
 * - 출발일별 행사:    POST /api/v1/dp/display/event      (gdsNo, date)
 * - 행사 상세:        GET  /api/v1/dp/display/event-detail (evtNo)
 * - 일정:            GET  /api/v1/dp/display/schedule   (evtNo)
 */

export function hanjintourYmd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function hanjintourSearchWindow(now: Date, days = 730): { startDate: string; endDate: string } {
  return { startDate: hanjintourYmd(now), endDate: hanjintourYmd(new Date(now.getTime() + days * 86_400_000)) }
}

const site = { siteNo: HANJINTOUR_SITE_NO, siteCd: HANJINTOUR_SITE_CD, realSiteCd: HANJINTOUR_SITE_CD, ptnNo: '' }

export function fetchHanjintourGnbMenu(c: HanjintourClient) {
  return c.call<unknown>('gnb', 'GET', `/api/v1/main/gnb-menu/${HANJINTOUR_SITE_NO}`)
}

export function fetchHanjintourDisplayList(
  c: HanjintourClient,
  p: { dspCtgNo: string; startDate: string; endDate: string; start: number; size: number },
) {
  return c.call<unknown>('list', 'POST', '/api/v1/dp/display', {
    ...site,
    dspCtgNo: p.dspCtgNo,
    filters: [],
    startDate: p.startDate,
    endDate: p.endDate,
    minPrice: null,
    maxPrice: null,
    startCtyCd: null,
    orderMthd: 'default',
    memberGrd: null,
    size: p.size,
    start: p.start,
  })
}

export function fetchHanjintourCalendar(c: HanjintourClient, p: { gdsNo: string; startDate: string; endDate: string }) {
  return c.call<unknown>('calendar', 'POST', '/api/v1/dp/display/calendar', {
    ...site,
    gdsNo: p.gdsNo,
    startDate: p.startDate,
    endDate: p.endDate,
    memberGrd: null,
    filters: [],
  })
}

export function fetchHanjintourEventList(
  c: HanjintourClient,
  p: { gdsNo: string; date: string; startDate: string; endDate: string; size?: number },
) {
  return c.call<unknown>('event', 'POST', '/api/v1/dp/display/event', {
    ...site,
    gdsNo: p.gdsNo,
    date: p.date,
    startDate: p.startDate,
    endDate: p.endDate,
    reserveYn: false,
    confirmYn: false,
    filters: [],
    size: p.size ?? 99,
  })
}

export function fetchHanjintourEventDetail(c: HanjintourClient, evtNo: string) {
  return c.call<unknown>('event-detail', 'GET', '/api/v1/dp/display/event-detail', { evtNo })
}

export function fetchHanjintourSchedule(c: HanjintourClient, evtNo: string) {
  return c.call<unknown>('schedule', 'GET', '/api/v1/dp/display/schedule', { evtNo })
}
