/**
 * 한진 미리보기: 항공·옵션·쇼핑·일정 보정 필드 스모크
 * npx tsx scripts/verify-hanjintour-preview-fields.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildHanjintourRegisterParsed } from '../lib/hanjintour-register-preview-from-base'
import { runHanjintourParseAndRegisterDev } from '../DEV/lib/parse-and-register-hanjintour-orchestration'

const url =
  'https://www.hanjintravel.com/dp/display/displayDetail?gdsNo=KW36098&evtNo=OP20260417377'
const html = readFileSync(join(process.cwd(), 'DEV/fixtures/hanjintour-kw36098-detail.html'), 'utf8')

const airlineTransport = `출발
진에어
진에어
LJ043편
총 04시간 45분 소요
서울(ICN)
26.04.15 (수) 21:00
이동
보홀/팡라오(TAG)
26.04.16 (목) 00:45
도착
진에어
진에어
LJ044편
총 04시간 40분 소요
보홀/팡라오(TAG)
26.04.19 (일) 01:45
이동
서울(ICN)
26.04.19 (일) 07:25`

const optionalTour = [
  '도시\t선택관광명\t가격(1인당)\t소요시간\t대체일정',
  '뉴욕\tMOMA 현대미술관\t성인 40 USD(미국 달러)\t약 1시간\t주변 자유시간',
  '나이아가라 폭포\t바람의동굴\t성인 40 USD(미국 달러)\t약 1시간\t미국측 나이아가라 폭포 주변 자유시간',
  '나이아가라 폴스\t스카이론타워 전망대 & 중식 업그레이드\t성인 110 USD(미국 달러)\t약 1시간 30분\t나이아가라 자유시간',
  '나이아가라 폴스\t나이아가라 헬기 투어\t성인 160 USD(미국 달러)\t약 15분\t주변 자유 시간',
  '퀘벡시티\t세인트 안 캐년(Canyon Sainte-Anne)\t성인 50 USD(미국 달러)\t약 1시간\t주변 자유시간',
].join('\n')

async function main() {
  const orch = await runHanjintourParseAndRegisterDev({
    detailHtml: html,
    detailUrl: url,
    runScraper: false,
  })
  const basePasted = { airlineTransport, optionalTour, shopping: '' as string }
  const pNoShop = buildHanjintourRegisterParsed({ base: orch.base, pasted: basePasted })
  const pPaste = buildHanjintourRegisterParsed({
    base: orch.base,
    pasted: { ...basePasted, shopping: '쇼핑 2회' },
  })
  const pasted = { airlineTransport, optionalTour, shopping: '' }
  const before = orch.base.schedule
  const p = pNoShop
  const fs = p.detailBodyStructured!.flightStructured
  const opt = JSON.parse(p.optionalToursStructured ?? '{"rows":[]}')
  const out = {
    flight: {
      airlineName: fs.airlineName,
      outboundFlightNo: fs.outbound.flightNo,
      inboundFlightNo: fs.inbound.flightNo,
      outboundDepartureAirport: fs.outbound.departureAirport,
      outboundArrivalAirport: fs.outbound.arrivalAirport,
      outboundDepartureDateTime: [fs.outbound.departureDate, fs.outbound.departureTime].filter(Boolean).join(' '),
      outboundArrivalDateTime: [fs.outbound.arrivalDate, fs.outbound.arrivalTime].filter(Boolean).join(' '),
      inboundDepartureAirport: fs.inbound.departureAirport,
      inboundArrivalAirport: fs.inbound.arrivalAirport,
      inboundDepartureDateTime: [fs.inbound.departureDate, fs.inbound.departureTime].filter(Boolean).join(' '),
      inboundArrivalDateTime: [fs.inbound.arrivalDate, fs.inbound.arrivalTime].filter(Boolean).join(' '),
      totalFlightDurationTextOutbound: fs.outbound.durationText,
      totalFlightDurationTextInbound: fs.inbound.durationText,
      departureSegmentText: p.departureSegmentText,
      returnSegmentText: p.returnSegmentText,
    },
    optional_sample_rows: opt.rows?.slice(0, 5),
    shopping_no_paste: {
      shoppingVisitCount: pNoShop.shoppingVisitCount,
      shoppingSummaryText: pNoShop.shoppingSummaryText,
      hasShopping: pNoShop.hasShopping,
    },
    shopping_pasted_count_line: {
      shoppingVisitCount: pPaste.shoppingVisitCount,
      shoppingSummaryText: pPaste.shoppingSummaryText,
      hasShopping: pPaste.hasShopping,
    },
    day1_before: before.find((d) => d.day === 1)?.description,
    day1_after: p.schedule.find((d) => d.day === 1)?.description,
    day9_before: before.find((d) => d.day === 9)?.description,
    day9_after: p.schedule.find((d) => d.day === 9)?.description,
    day10_before: before.find((d) => d.day === 10)?.description,
    day10_after: p.schedule.find((d) => d.day === 10)?.description,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
