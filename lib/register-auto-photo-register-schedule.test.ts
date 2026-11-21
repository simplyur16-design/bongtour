import { describe, expect, it, vi, beforeEach } from 'vitest'

const runJob = vi.fn(async () => ({ ok: true }))
const sw = { fill: false, flip: false, record: false }
vi.mock('@/lib/register-auto-photo-register-job', () => ({
  runAutoPhotoRegisterJob: (...a: unknown[]) => runJob(...(a as [])),
  autoRegisterSwitches: () => ({ ...sw }),
}))
vi.mock('@/lib/cron-auth', () => ({
  getBongtourCronSecret: () => 'x',
  isAuthorizedCronRequest: () => true,
}))
vi.mock('@/lib/public-response-guard', () => ({
  jsonWithLeakGuard: (body: unknown, _k: string, init?: { status?: number }) =>
    new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
}))

import { POST } from '@/app/api/cron/register-auto-photo-register/route'
import { shouldScheduleStandaloneAutoPhotoCron } from '@/lib/instrumentation-register-pre-photo-self-heal-cron'
import { readFileSync } from 'node:fs'

describe('register-auto-photo-register schedule', () => {
  beforeEach(() => {
    runJob.mockClear()
    sw.fill = sw.flip = sw.record = false
  })
  it('scheduled call does nothing while every switch is off (default)', async () => {
    const res = await POST(new Request('https://x/api/cron/register-auto-photo-register?scheduled=1&limit=50', { method: 'POST' }))
    expect(res.status).toBe(202)
    expect(await res.json()).toMatchObject({ started: false, reason: 'switches_off' })
    expect(runJob).not.toHaveBeenCalled()
  })
  it('scheduled call runs the job once a switch is on', async () => {
    sw.fill = true
    const res = await POST(new Request('https://x/api/cron/register-auto-photo-register?scheduled=1&limit=50', { method: 'POST' }))
    expect(res.status).toBe(202)
    expect(runJob).toHaveBeenCalledWith({ limit: 50 })
  })
  it('the existing self-heal workflow calls it after the heal, with scheduled=1', () => {
    const yml = readFileSync('.github/workflows/register-pre-photo-self-heal.yml', 'utf8')
    expect(yml).toContain('workflow_dispatch:')
    expect(yml).not.toContain('schedule:')
    expect(yml).not.toContain('cron:')
    expect(yml).toContain('needs: register-pre-photo-self-heal')
    expect(yml).toContain('/api/cron/register-auto-photo-register?scheduled=1&limit=50')
    expect(yml).toContain('skipIngest=1&probe=0&limit=200')
  })

  it('worker heal cron runs the photo job in the same tick unless every switch is off', () => {
    const cron = readFileSync('lib/instrumentation-register-pre-photo-self-heal-cron.ts', 'utf8')
    expect(cron).toContain("REGISTER_PRE_PHOTO_HEAL_ONLY_CRON = '15 6,14,22 * * *'")
    expect(cron).toContain('runAutoPhotoRegisterJob')
    expect(cron).toContain('switches_off')
    expect(cron).toContain('if (healOnlyTickRunning) return')
    expect(cron).toContain('auto-photo-done')
  })

  it('schedules the photo job on a process whose heal cron is off and a switch is on', () => {
    expect(shouldScheduleStandaloneAutoPhotoCron({ healCronEnabled: false, anySwitchOn: true })).toBe(true)
    expect(shouldScheduleStandaloneAutoPhotoCron({ healCronEnabled: true, anySwitchOn: true })).toBe(false)
    expect(shouldScheduleStandaloneAutoPhotoCron({ healCronEnabled: false, anySwitchOn: false })).toBe(false)
    const cron = readFileSync('lib/instrumentation-register-pre-photo-self-heal-cron.ts', 'utf8')
    const instrumentation = readFileSync('instrumentation.ts', 'utf8')
    expect(cron).toContain("REGISTER_AUTO_PHOTO_WHEN_HEAL_DISABLED_CRON = '30 * * * *'")
    expect(cron).toContain('startInstrumentationRegisterAutoPhotoWhenHealDisabled')
    expect(instrumentation).toContain('startInstrumentationRegisterAutoPhotoWhenHealDisabled()')
  })
})
