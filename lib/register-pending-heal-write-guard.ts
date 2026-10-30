/**
 * REGRESSION-FREEZE[heal-write-guard-registered]: registered inferred Product field skip + audit — manifest
 * Pure write/skip decisions for pending self-heal Product field updates.
 */

export type HealWriteField =
  | 'destination'
  | 'localDepartureTag'
  | 'departureAirportLabel'
  | 'sportsThemeTag'
  | 'schedule'
  | 'registrationStatus'
  | 'rawMeta'
  | 'registerPrePhotoQueueReady'
  | 'registerPhotosReady'
  | 'rejectReason'
  | 'rejectedAt'
  | 'countryKey'
  | 'continentKey'
  | 'cityKey'
  | 'nodeKey'
  | 'groupKey'
  | 'continent'
  | 'country'
  | 'city'
  | 'primaryDestination'
  | 'destinationRaw'
  | 'locationMatchConfidence'
  | 'locationMatchSource'
  | 'title'
  | 'highlightPoints'

export type HealFieldProvenance = 'supplier_direct' | 'inferred' | 'derived_ops'

export type DecideHealFieldWriteInput = {
  registrationStatus: string | null | undefined
  field: HealWriteField
  before: unknown
  after: unknown
  reason: string
  provenance: HealFieldProvenance
}

export type DecideHealFieldWriteResult = {
  action: 'write' | 'skip'
  logReason: string
}

const INFERRED_PRODUCT_FIELDS = new Set<HealWriteField>([
  'destination',
  'localDepartureTag',
  'departureAirportLabel',
  'sportsThemeTag',
  'countryKey',
  'continentKey',
  'cityKey',
  'nodeKey',
  'groupKey',
  'continent',
  'country',
  'city',
  'primaryDestination',
  'destinationRaw',
  'locationMatchConfidence',
  'locationMatchSource',
])

function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** Empty / nullish after means "unknown" — never invent a default write. */
export function isUnknownHealValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string' && !v.trim()) return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

/**
 * Decide whether heal may persist a Product field change.
 * - title: never
 * - registered + inferred: skip (log skipped-registered-needs-review)
 * - after unknown while before had value and provenance inferred: skip (no default fill)
 */
export function decideHealFieldWrite(input: DecideHealFieldWriteInput): DecideHealFieldWriteResult {
  const { field, before, after, reason, provenance } = input
  const status = String(input.registrationStatus ?? '').trim()

  if (field === 'title') {
    return { action: 'skip', logReason: 'heal-never-write-product-title' }
  }

  if (deepEqualJson(before, after)) {
    return { action: 'skip', logReason: 'unchanged' }
  }

  if (provenance === 'inferred' && isUnknownHealValue(after) && !isUnknownHealValue(before)) {
    return { action: 'skip', logReason: 'unknown-stays-unknown' }
  }

  if (provenance === 'inferred' && isUnknownHealValue(after) && isUnknownHealValue(before)) {
    return { action: 'skip', logReason: 'unknown-stays-unknown' }
  }

  if (status === 'registered' && provenance === 'inferred' && INFERRED_PRODUCT_FIELDS.has(field)) {
    return { action: 'skip', logReason: 'skipped-registered-needs-review' }
  }

  if (status === 'registered' && field === 'registrationStatus' && after !== 'registered') {
    return { action: 'skip', logReason: 'registered-no-demotion' }
  }

  return { action: 'write', logReason: reason || 'heal-write' }
}

export type HealFieldAuditLine = {
  productId: string
  field: HealWriteField
  before: string
  after: string
  reason: string
  action: 'write' | 'skip'
  logReason: string
}

const TRUNC = 160

export function truncateHealAuditValue(v: unknown): string {
  let s: string
  try {
    s = typeof v === 'string' ? v : JSON.stringify(v)
  } catch {
    s = String(v)
  }
  if (s == null) return ''
  s = String(s)
  if (s.length <= TRUNC) return s
  return `${s.slice(0, TRUNC)}…`
}

/** Structured audit log — never pass secrets. */
export function logHealFieldAudit(line: HealFieldAuditLine): void {
  console.info(
    '[register-pre-photo-self-heal] field-audit',
    JSON.stringify({
      productId: line.productId,
      field: line.field,
      before: line.before,
      after: line.after,
      reason: line.reason,
      action: line.action,
      logReason: line.logReason,
    }),
  )
}

/** Merge a needs-review note into rawMeta without schema change (rawMeta JSON). */
export function mergeRegisteredHealNeedsReviewIntoRawMeta(
  rawMeta: string | null | undefined,
  skippedFields: string[],
): string {
  if (!skippedFields.length) return String(rawMeta ?? '')
  let obj: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(String(rawMeta ?? '') || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      obj = parsed as Record<string, unknown>
    }
  } catch {
    obj = {}
  }
  obj.healRegisteredNeedsReview = {
    at: new Date().toISOString(),
    skippedFields: [...new Set(skippedFields)],
    note: 'skipped-registered-needs-review',
  }
  return JSON.stringify(obj)
}
