/**
 * 하나투어 항공 붙여넣기 결정적 파서 스모크 검증(LLM 없음).
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { parseFlightSectionHanatour } from '@/lib/flight-parser-hanatour'
import { resolveDirectedFlightLinesHanatour } from '@/lib/register-flight-hanatour'
import { formatDirectedFlightRow } from '@/lib/flight-user-display'

const samples: { name: string; text: string }[] = [
  {
    name: '운영 샘플(빈 줄·ZE0535총)',
    text: `이스타항공

출발 : 2026.05.01(금) 20:25 2026.05.02(토) 01:15 ZE0535총 05시간 50분 소요

도착 : 2026.05.05(화) 02:20 2026.05.05(화) 08:40 ZE0536총 05시간 20분 소요`,
  },
  {
    name: '항공사·출발·도착 단일 줄바꿈',
    text: `이스타항공
출발 : 2026.05.01(금) 20:25 2026.05.02(토) 01:15 ZE0535총05시간 50분 소요
도착 : 2026.05.05(화) 02:20 2026.05.05(화) 08:40 ZE0536 총 05시간 20분 소요`,
  },
  {
    name: '소요 생략(정규화로 소요 부여)',
    text: `제주항공
출발 : 2026.05.01(금) 10:00 2026.05.01(금) 11:30 7C123총 1시간 30분
도착 : 2026.05.05(화) 15:00 2026.05.05(화) 16:30 7C124총 1시간 30분`,
  },
]

function combineFlightDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`
  return dd || tt || null
}

function assertCase(name: string, fs: ReturnType<typeof parseFlightSectionHanatour>) {
  const ok =
    (fs.debug?.status === 'success' || fs.debug?.status === 'partial') &&
    Boolean(fs.outbound.flightNo) &&
    Boolean(fs.inbound.flightNo) &&
    Boolean(fs.outbound.departureDate && fs.outbound.arrivalDate)
  if (!ok) {
    console.error('FAIL', name, fs.debug?.status, fs.outbound, fs.inbound)
    throw new Error(`VERIFY_FAIL: ${name}`)
  }
}

function main() {
  for (const { name, text } of samples) {
    const fs = parseFlightSectionHanatour(text, null)
    assertCase(name, fs)
    const detailBody = {
      flightStructured: fs,
      raw: {},
      sections: [],
      normalizedRaw: text,
    } as unknown as Parameters<typeof resolveDirectedFlightLinesHanatour>[0]
    const lines = resolveDirectedFlightLinesHanatour(detailBody)
    const ob = fs.outbound
    const ib = fs.inbound
    const pubOb = formatDirectedFlightRow('가는편', {
      departureAirport: ob.departureAirport,
      arrivalAirport: ob.arrivalAirport,
      departureAtText: combineFlightDateTime(ob.departureDate, ob.departureTime),
      arrivalAtText: combineFlightDateTime(ob.arrivalDate, ob.arrivalTime),
      flightNo: ob.flightNo,
      durationText: ob.durationText,
    })
    const pubIb = formatDirectedFlightRow('오는편', {
      departureAirport: ib.departureAirport,
      arrivalAirport: ib.arrivalAirport,
      departureAtText: combineFlightDateTime(ib.departureDate, ib.departureTime),
      arrivalAtText: combineFlightDateTime(ib.arrivalDate, ib.arrivalTime),
      flightNo: ib.flightNo,
      durationText: ib.durationText,
    })
    if (!pubOb.line?.trim() || !pubIb.line?.trim()) {
      console.error(name, 'missing public row', pubOb, pubIb)
      throw new Error(`VERIFY_FAIL public row: ${name}`)
    }
    console.log('OK', name)
    console.log('  ', lines.departureSegmentFromStructured?.slice(0, 72) + '…')
  }
  console.log('VERIFY_OK all', samples.length)
}

main()
