/** 공개 직렬화 시 재귀 제거용 — assert와 동일 목록 */
export const FORBIDDEN_PUBLIC_KEYS = new Set([
  'imageManualSelected',
  'imageSelectionMode',
  'imageCandidateOrigin',
  'mappingStatus',
  'notes',
  'usageSource',
  'usageCount',
  'lastUsedAt',
  'usedIn',
  'debug',
  'sourceMeta',
  /** 관리자/스크래퍼 진단 필드 — 공개 직렬화에 절대 포함되면 안 됨 */
  'liveError',
  'diagnostics',
  'stderrSummary',
  'stdoutSummary',
  'imageReviewNotes',
  'adminNotes',
  'internalMeta',
  'scrapedDiagnostics',
])

function walk(value: unknown, path: string[] = [], found: string[] = []): string[] {
  if (value == null) return found
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, [...path, String(i)], found))
    return found
  }
  if (typeof value !== 'object') return found
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(k)) found.push([...path, k].join('.'))
    walk(v, [...path, k], found)
  }
  return found
}

/**
 * 공개 응답에 내부 운영 메타가 섞여 나가는 것을 런타임에서 차단.
 */
export function assertNoInternalMetaLeak(payload: unknown, context: string) {
  const found = walk(payload)
  if (found.length > 0) {
    throw new Error(`[public-response-guard] ${context}: forbidden keys leaked -> ${found.join(', ')}`)
  }
}
