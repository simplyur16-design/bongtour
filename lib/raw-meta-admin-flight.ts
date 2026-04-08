import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

export function getFlightAdminJsonFromRawMeta(rawMeta: string | null | undefined): string | null {
  const meta = parseRawMetaObject(rawMeta)
  const structured = meta.structuredSignals
  if (!structured || typeof structured !== 'object' || Array.isArray(structured)) return null
  const candidate = (structured as Record<string, unknown>).flightAdminJson
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim()
    return trimmed || null
  }
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    try {
      return JSON.stringify(candidate)
    } catch {
      return null
    }
  }
  return null
}

export function mergeFlightAdminJsonIntoRawMeta(
  rawMeta: string | null | undefined,
  flightAdminJson: string | null
): string | null {
  const meta = parseRawMetaObject(rawMeta)
  const structuredBase =
    meta.structuredSignals && typeof meta.structuredSignals === 'object' && !Array.isArray(meta.structuredSignals)
      ? ({ ...(meta.structuredSignals as Record<string, unknown>) } as Record<string, unknown>)
      : {}
  if (flightAdminJson && flightAdminJson.trim()) {
    structuredBase.flightAdminJson = flightAdminJson.trim()
  } else {
    delete structuredBase.flightAdminJson
  }
  const next: Record<string, unknown> = { ...meta }
  if (Object.keys(structuredBase).length > 0) next.structuredSignals = structuredBase
  else delete next.structuredSignals
  return Object.keys(next).length > 0 ? JSON.stringify(next) : null
}

/** structuredSignals.flightManualCorrection — 항공 편명/시간 수동 보정 */
export function mergeFlightManualCorrectionIntoRawMeta(
  rawMeta: string | null | undefined,
  payload: FlightManualCorrectionPayload | null
): string | null {
  const meta = parseRawMetaObject(rawMeta)
  const structuredBase =
    meta.structuredSignals && typeof meta.structuredSignals === 'object' && !Array.isArray(meta.structuredSignals)
      ? ({ ...(meta.structuredSignals as Record<string, unknown>) } as Record<string, unknown>)
      : {}
  if (payload && Object.keys(payload).length > 0) {
    structuredBase.flightManualCorrection = payload as unknown
  } else {
    delete structuredBase.flightManualCorrection
  }
  const next: Record<string, unknown> = { ...meta }
  if (Object.keys(structuredBase).length > 0) next.structuredSignals = structuredBase
  else delete next.structuredSignals
  return Object.keys(next).length > 0 ? JSON.stringify(next) : null
}
