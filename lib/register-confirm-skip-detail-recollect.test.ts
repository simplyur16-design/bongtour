/**
 * REGRESSION-FREEZE[register-confirm-skip-detail-recollect]
 * REGRESSION-FREEZE[schedule-image-keyword-return-gate-block]
 */
import { describe, expect, it } from 'vitest'
import { stripRegisterInternalArtifacts } from '@/lib/register-llm-schema-ybtour'
import { stripRegisterInternalArtifacts as stripHanatour } from '@/lib/register-llm-schema-hanatour'
import { shouldSkipConfirmDetailPatch } from '@/lib/register-confirm-skip-detail-patch'
import { applyRegisterScheduleRouteTextImageKeywordsToRows } from '@/lib/register-schedule-route-text-image-keyword-ssot'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'

describe('register-confirm-skip-detail-recollect', () => {
  it('strip keeps DetailCollectRan so confirm can skip re-fetch', () => {
    const stripped = stripRegisterInternalArtifacts({
      originCode: 'AVP7297',
      title: 't',
      ybtourDetailCollectRan: true,
      ybtourDetailCollectSummary: 'ok',
      registerParseAudit: { x: 1 },
      registerAdminPersistedLlmParsedJson: '{}',
    } as never)
    expect(stripped.ybtourDetailCollectRan).toBe(true)
    expect(stripped.ybtourDetailCollectSummary).toBe('ok')
    expect((stripped as { registerParseAudit?: unknown }).registerParseAudit).toBeUndefined()
    expect((stripped as { registerAdminPersistedLlmParsedJson?: unknown }).registerAdminPersistedLlmParsedJson).toBeUndefined()

    const h = stripHanatour({
      originCode: 'X',
      hanatourDetailCollectRan: true,
      hanatourDetailCollectSummary: 'ok',
    } as never)
    expect(h.hanatourDetailCollectRan).toBe(true)
  })

  // REGRESSION-FREEZE[register-confirm-skip-detail-recollect]: skip only when reuse-safe — manifest
  it('shouldSkipConfirmDetailPatch — empty prices/schedule without Ran must not skip (422 guard)', () => {
    expect(
      shouldSkipConfirmDetailPatch({
        mode: 'confirm',
        hasParsed: true,
        reusedConfirmAnalysis: false,
        detailCollectRan: undefined,
        pricesLen: 0,
        scheduleLen: 5,
      }),
    ).toBe(false)
    expect(
      shouldSkipConfirmDetailPatch({
        mode: 'confirm',
        hasParsed: true,
        reusedConfirmAnalysis: false,
        detailCollectRan: true,
        pricesLen: 0,
        scheduleLen: 0,
      }),
    ).toBe(true)
    expect(
      shouldSkipConfirmDetailPatch({
        mode: 'confirm',
        hasParsed: true,
        reusedConfirmAnalysis: false,
        detailCollectRan: false,
        pricesLen: 3,
        scheduleLen: 5,
      }),
    ).toBe(true)
  })
})

describe('schedule-image-keyword-return-gate-block', () => {
  // REGRESSION-FREEZE[schedule-image-keyword-return-gate-block]: bare Gate / 탑승게이트 — manifest
  it('blocks bare Gate and airport boarding gate, keeps landmark Gate names', () => {
    expect(isBlockedScheduleImageKeyword('Gate')).toBe(true)
    expect(isBlockedScheduleImageKeyword('Departure Gate')).toBe(true)
    expect(isBlockedScheduleImageKeyword('Airport Gate')).toBe(true)
    expect(isBlockedScheduleImageKeyword('Boarding Gate')).toBe(true)
    expect(isBlockedScheduleImageKeyword('India Gate')).toBe(false)
    expect(isBlockedScheduleImageKeyword('Golden Gate Bridge')).toBe(false)
    expect(isBlockedScheduleImageKeyword('Karl Johans Gate')).toBe(false)
  })

  it('return forward does not keep bare Gate from route', () => {
    expect(isRegisterScheduleRoutePlaceNoise('탑승 게이트')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('게이트')).toBe(true)
    const out = applyRegisterScheduleRouteTextImageKeywordsToRows([
      {
        day: 1,
        routeText: '인천 - 나트랑',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '나트랑 - 포나가르 참 사원',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '나트랑 - 탑승 게이트 - 인천',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    const last = out.find((r) => r.day === 3)
    const kw = String(last?.imageKeyword ?? '').trim()
    expect(kw).not.toMatch(/^gates?$/i)
    expect(kw).not.toMatch(/departure\s+gate/i)
  })
})
