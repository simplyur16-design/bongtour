import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { missingDayFillAction } from '@/lib/register-auto-photo-missing-day'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

describe('photo-autofill-wiring: 연결부 정적 가드', () => {
  const route = read('app/api/travel/process-images/route.ts')

  it('자동 채움(strict)은 풀 일괄 배정·미리 만든 세트·정책 재시도·두 번째 칸 채움을 쓰지 않는다', () => {
    expect(route).toContain('const strictAutofill = photoChainV2 && fillMissingOnly')
    expect(route).toMatch(/!strictAutofill &&\s+!areScheduleImageKeywordsDistinct/)
    expect(route).toContain('poolList.length === 0 && !strictAutofill ? await getPreMadeImageSet')
    expect(route).toContain('const retry = strictAutofill ? null : await runChain(')
    expect(route).toMatch(/if \(strictAutofill\) continue/)
  })

  it('자동 채움 대표·일차 경로에는 AI 생성이 없다', () => {
    const start = route.indexOf('const strictDeps = strictAutofill')
    const end = route.indexOf('} else if (preserveHero) {', start)
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    expect(route.slice(start, end)).not.toMatch(/generateImageWithGemini|savePhotoToPool|Gemini/)
    const dayStart = route.indexOf('const strictDayPick = async')
    const dayEnd = route.indexOf('const picked = strictAutofill', dayStart)
    expect(route.slice(dayStart, dayEnd)).not.toMatch(/generateImageWithGemini|savePhotoToPool|Gemini/)
  })

  it('일차 선택은 strict 일 때 acquireVerifiedPhoto 를 쓴다', () => {
    expect(route).toContain('const picked = strictAutofill ? await strictDayPick() : await selectScheduleDayPhoto({')
    expect(route).toContain('acquireVerifiedPhoto(')
  })

  it('대표를 못 구하면 대표는 쓰지 않고 일정 칸만 저장한다', () => {
    expect(route).toContain('const strictNoCover = strictAutofill && !existingHeroUrl && !bgPhoto.url')
    expect(route).toContain('data: { schedule: scheduleStrFinal } })')
  })

  it('예외는 건너뜀(skipped)이 아닌 것만 기록하고 응답에 싣는다', () => {
    expect(route).toContain('if (!res.skipped) await strictRecord(res.exception)')
    expect(route).toMatch(/exceptions: strictExceptions\.map/)
  })

  it('이미 채워진 칸은 덮어쓰지 않는다(keep)', () => {
    expect(missingDayFillAction({ day: 2, title: '', description: '', imageKeyword: 'Blue Mosque', imageUrl: 'https://cdn.example.com/x.webp' } as never, 5)).toBe('keep')
    expect(route).toContain("if (action === 'keep') {")
  })

  it('자동 등록 job: 힐 → 사진 게이트 → 보류 사유(예외 요약) → 야간 점검, 크론 호출 형태는 그대로', () => {
    const job = read('lib/register-auto-photo-register-job.ts')
    expect(job).toContain('runPhotoHealForProduct(prisma, id,')
    expect(job).toContain('evaluateRegistrationPhotos(buildRegistrationPhotoInput(')
    expect(job).toContain('registrationBlockCodes(photoGate.blocks)')
    expect(job).toContain('summarizePhotoExceptions(healExceptions, 200)')
    expect(job).toContain('sw.fill && isNightlyAuditWindowKst(new Date())')
    expect(job.indexOf('runPhotoHealForProduct(prisma, id,')).toBeLessThan(job.indexOf('// 05: 자동 검사'))
    const cron = read('app/api/cron/register-auto-photo-register/route.ts')
    expect(cron).toMatch(/runAutoPhotoRegisterJob\(\{ limit/)
  })

  it('관리자 등록 전환(registered)에도 같은 사진 게이트가 있고 400 으로 막는다', () => {
    const patch = read('app/api/admin/products/[id]/route.ts')
    expect(patch).toContain('evaluateStoredProductPhotosForRegistration(')
    expect(patch).toContain('missing: { photoGate: true')
    expect(patch.indexOf('evaluateStoredProductPhotosForRegistration(')).toBeLessThan(patch.indexOf('checkRegisterFlipHumanReviewGate'))
  })

  it('야간 점검은 사진 칸 외 상품 칸을 쓰지 않는다(쓰기 칸 가드)', () => {
    const runner = read('lib/photo-gate-runner.ts')
    const nightly = runner.slice(runner.indexOf('export async function runPublicPhotoNightlyAuditLive'))
    expect(nightly).not.toMatch(/\btitle\s*:|minBookableAdultPrice|price\s*:|\bdescription\s*:/)
    expect(nightly).toContain("registrationStatus: 'registered'")
  })
})
