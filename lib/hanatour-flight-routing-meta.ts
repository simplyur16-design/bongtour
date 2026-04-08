/**
 * 하나투어 전용: 항공 성격(직항/경유) — `duration` 등 핵심정보 한 줄의 `경유있음`을 반영하고, 기본 `직항` 금지.
 */
import {
  buildFlightRoutingHaystack,
  inferFlightRoutingMeta,
  parseFlightRoutingFromSupplierHaystack,
  type FlightRoutingMeta,
  type FlightRoutingProductInput,
} from '@/lib/flight-routing-meta'

function metaFromTextParse(
  text: NonNullable<ReturnType<typeof parseFlightRoutingFromSupplierHaystack>>
): FlightRoutingMeta {
  if (text.kind === 'numbered') {
    const n = text.n
    if (n <= 0)
      return {
        flightRoutingType: 'direct',
        stopCount: 0,
        flightRoutingLabel: '직항',
        source: 'supplier_text',
      }
    if (n === 1)
      return {
        flightRoutingType: 'stopover',
        stopCount: 1,
        flightRoutingLabel: '경유 1회',
        source: 'supplier_text',
      }
    if (n === 2)
      return {
        flightRoutingType: 'multi_stop',
        stopCount: 2,
        flightRoutingLabel: '경유 2회',
        source: 'supplier_text',
      }
    return {
      flightRoutingType: 'multi_stop',
      stopCount: n,
      flightRoutingLabel: '경유 있음',
      source: 'supplier_text',
    }
  }
  if (text.kind === 'direct') {
    return {
      flightRoutingType: 'direct',
      stopCount: 0,
      flightRoutingLabel: '직항',
      source: 'supplier_text',
    }
  }
  return {
    flightRoutingType: 'stopover',
    stopCount: -1,
    flightRoutingLabel: '경유 있음',
    source: 'partial_text',
  }
}

/**
 * `duration`(9박 12일 외국항공 경유있음 …)을 title과 동일 우선순위로 haystack에 넣기 위해 input.title에 병합한 뒤 파싱.
 */
export function inferHanatourFlightRoutingMeta(
  input: FlightRoutingProductInput & { duration?: string | null }
): FlightRoutingMeta {
  const dur = (input.duration ?? '').replace(/\s+/g, ' ').trim()
  const title = (input.title ?? '').trim()
  const augmentedTitle = dur ? (title ? `${dur} ${title}` : dur) : title
  const inputAug: FlightRoutingProductInput = { ...input, title: augmentedTitle || null }

  const fullHay = buildFlightRoutingHaystack(inputAug)

  if (/경유있음|경유\s*있\s*음/i.test(fullHay) && !/경유\s*없음|경유없음/i.test(fullHay)) {
    return {
      flightRoutingType: 'stopover',
      stopCount: -1,
      flightRoutingLabel: '경유 있음',
      source: 'supplier_text',
    }
  }
  if (
    (/경유없음|경유\s*없\s*음|직항|직\s*항|무\s*경유|논\s*스탑|논스탑/i.test(fullHay)) &&
    !/경유\s*있/i.test(fullHay)
  ) {
    return {
      flightRoutingType: 'direct',
      stopCount: 0,
      flightRoutingLabel: '직항',
      source: 'supplier_text',
    }
  }

  const text = parseFlightRoutingFromSupplierHaystack(fullHay)
  if (text) return metaFromTextParse(text)

  const fallback = inferFlightRoutingMeta(inputAug)
  if (fallback.source === 'default' && fallback.flightRoutingLabel === '직항') {
    return {
      flightRoutingType: 'unknown',
      stopCount: -1,
      flightRoutingLabel: '항공 일정 문의',
      source: 'default',
    }
  }
  return fallback
}
