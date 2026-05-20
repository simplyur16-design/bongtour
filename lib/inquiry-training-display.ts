import { inquiryPayloadField, parseInquiryPayloadJson } from '@/lib/inquiry-notification-format'

export type TrainingInquiryDetailMode = 'quick' | 'quote'

export type TrainingDisplayFields = {
  inquiryDetailMode: TrainingInquiryDetailMode | null
  organizationName: string | null
  destinationSummary: string | null
  schedule: string | null
  headcount: string | null
  serviceScope: string | null
  trainingPurpose: string | null
}

function payloadText(payload: Record<string, unknown>, key: string): string | null {
  const v = inquiryPayloadField(payload, key)
  return v === '-' ? null : v
}

function scheduleFromPayload(payload: Record<string, unknown>): string | null {
  const d = payloadText(payload, 'preferredDepartureDate')
  if (d) return d
  const m = payloadText(payload, 'preferredDepartureMonth')
  return m
}

type TrainingMessageExtractKey =
  | 'organizationName'
  | 'destinationSummary'
  | 'headcount'
  | 'serviceScope'
  | 'trainingPurpose'

/** 본문에만 적힌 항목을 간단히 끌어옴 (간편 문의용) */
function extractFromMessage(message: string | null | undefined): Partial<
  Pick<TrainingDisplayFields, TrainingMessageExtractKey>
> {
  const msg = (message ?? '').trim()
  if (!msg) return {}

  const out: Partial<Pick<TrainingDisplayFields, TrainingMessageExtractKey>> = {}
  const linePatterns: Array<[TrainingMessageExtractKey, RegExp]> = [
    ['organizationName', /(?:기관명|학교명|단체명)\s*[:：]\s*(.+)/i],
    ['destinationSummary', /(?:희망\s*)?(?:국가|도시|목적지|지역)\s*[:：]\s*(.+)/i],
    ['headcount', /(?:예상\s*)?인원\s*[:：]\s*(\d+)/i],
    ['serviceScope', /(?:필요한\s*)?서비스\s*[:：]\s*(.+)/i],
    ['trainingPurpose', /(?:연수\s*)?목적\s*[:：]\s*(.+)/i],
  ]

  for (const [key, re] of linePatterns) {
    const m = msg.match(re)
    if (m?.[1]?.trim()) out[key] = m[1].trim().slice(0, 120)
  }

  if (!out.headcount) {
    const hm = msg.match(/(\d{1,4})\s*명/)
    if (hm?.[1]) out.headcount = hm[1]
  }

  return out
}

export function resolveTrainingInquiryDetailMode(
  payload: Record<string, unknown>
): TrainingInquiryDetailMode | null {
  const raw = payload.inquiryDetailMode
  if (raw === 'quick' || raw === 'quote') return raw
  return null
}

export function resolveTrainingDisplayFields(
  payloadJson: string | null,
  message: string | null | undefined
): TrainingDisplayFields {
  const payload = parseInquiryPayloadJson(payloadJson)
  const fromMsg = extractFromMessage(message)

  const pick = (key: TrainingMessageExtractKey, payloadKey?: string): string | null => {
    const pk = payloadKey ?? key
    const fromPayload = payloadText(payload, pk)
    if (fromPayload) return fromPayload
    const fromMessage = fromMsg[key]
    return typeof fromMessage === 'string' && fromMessage.trim() ? fromMessage.trim() : null
  }

  return {
    inquiryDetailMode: resolveTrainingInquiryDetailMode(payload),
    organizationName: pick('organizationName'),
    destinationSummary: pick('destinationSummary'),
    schedule: scheduleFromPayload(payload),
    headcount: pick('headcount'),
    serviceScope: pick('serviceScope'),
    trainingPurpose: pick('trainingPurpose'),
  }
}

/** 이메일·요약용 — 값 있는 줄만 */
export function trainingDisplaySummaryLines(fields: TrainingDisplayFields): string[] {
  const lines: string[] = []
  if (fields.inquiryDetailMode === 'quick') lines.push('접수 방식: 간편 문의')
  else if (fields.inquiryDetailMode === 'quote') lines.push('접수 방식: 견적 문의(일정·지역·인원 필수)')
  if (fields.serviceScope) lines.push(`필요 서비스: ${fields.serviceScope}`)
  if (fields.organizationName) lines.push(`기관명: ${fields.organizationName}`)
  if (fields.destinationSummary) lines.push(`목적지: ${fields.destinationSummary}`)
  if (fields.schedule) lines.push(`일정: ${fields.schedule}`)
  if (fields.headcount) lines.push(`인원: ${fields.headcount}명`)
  if (fields.trainingPurpose) lines.push(`연수 목적: ${fields.trainingPurpose}`)
  return lines
}
