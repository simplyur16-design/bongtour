/**
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 22:00–10:00 · 공급사당 3건 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING,
  REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING,
  REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES,
  minutesIntoRegisterPrePhotoIngestNightWindow,
  registerPrePhotoIngestNightTargetMinuteOffset,
  registerPrePhotoIngestNightWindowId,
  shouldRunRegisterPrePhotoIngestNightTick,
} from '../lib/register-pre-photo-ingest-night-window'
import { REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER } from '../lib/register-pre-photo-ingest-geo-slots'

describe('register-pre-photo-ingest-night-window', () => {
  it('공급사마다 하루 신규 3건이다', () => {
    assert.equal(REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER, 3)
  })

  it('KST 22:00–10:00 만 창이고 낮·10시는 쉰다', () => {
    const at2200 = new Date('2026-08-27T13:00:00.000Z')
    const at2159 = new Date('2026-08-27T12:59:00.000Z')
    const at0959 = new Date('2026-08-28T00:59:00.000Z')
    const at1000 = new Date('2026-08-28T01:00:00.000Z')
    const afternoon = new Date('2026-08-27T06:00:00.000Z')
    assert.equal(registerPrePhotoIngestNightWindowId(at2200), '2026-08-27')
    assert.equal(minutesIntoRegisterPrePhotoIngestNightWindow(at2200), 0)
    assert.equal(registerPrePhotoIngestNightWindowId(at2159), null)
    assert.equal(registerPrePhotoIngestNightWindowId(at0959), '2026-08-27')
    assert.equal(minutesIntoRegisterPrePhotoIngestNightWindow(at0959), 719)
    assert.equal(registerPrePhotoIngestNightWindowId(at1000), null)
    assert.equal(registerPrePhotoIngestNightWindowId(afternoon), null)
    assert.equal(REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES, 720)
  })

  it('창 안에서는 목표 시각 이후 한 번만 돈다', () => {
    const windowId = '2026-08-27'
    const target = registerPrePhotoIngestNightTargetMinuteOffset(windowId)
    assert.ok(target >= 0 && target < REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES)
    assert.equal(registerPrePhotoIngestNightTargetMinuteOffset(windowId), target)
    const startUtc = Date.parse('2026-08-27T13:00:00.000Z')
    const atTarget = new Date(startUtc + target * 60_000)
    if (target > 0) {
      assert.equal(shouldRunRegisterPrePhotoIngestNightTick(new Date(startUtc + (target - 1) * 60_000), null), false)
    }
    assert.equal(shouldRunRegisterPrePhotoIngestNightTick(atTarget, null), true)
    assert.equal(shouldRunRegisterPrePhotoIngestNightTick(atTarget, windowId), false)
    if (target + 5 < REGISTER_PRE_PHOTO_INGEST_NIGHT_WINDOW_MINUTES) {
      const later = new Date(startUtc + (target + 5) * 60_000)
      assert.equal(shouldRunRegisterPrePhotoIngestNightTick(later, null), true)
      assert.equal(shouldRunRegisterPrePhotoIngestNightTick(later, windowId), false)
    }
  })

  it('instrumentation cron 은 저녁 22–23시·오전 0–9시다', () => {
    const cron = readFileSync(
      new URL('../lib/instrumentation-register-pre-photo-self-heal-cron.ts', import.meta.url),
      'utf8',
    )
    assert.ok(cron.includes(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_EVENING))
    assert.ok(cron.includes(REGISTER_PRE_PHOTO_INGEST_NIGHT_CRON_MORNING))
    assert.match(cron, /Asia\/Seoul/)
    assert.match(cron, /shouldRunRegisterPrePhotoIngestNightTick/)
    assert.match(cron, /runRegisterPrePhotoDailyJob/)
    assert.equal(cron.includes("'30 6 * * *'"), false)
  })
})
