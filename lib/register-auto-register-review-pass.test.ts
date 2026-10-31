import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { AUTO_REGISTER_REVIEW_PASS_IDS, isAutoRegisterReviewPassed } from '@/lib/register-auto-register-review-pass'
import { AUTO_REGISTER_BLOCK_REASON_KO, formatAutoRegisterBlockReasons } from '@/lib/register-auto-register-gate'

describe('auto-register review-pass allowlist (봉실장 10/31)', () => {
  it('2차 통과 44개만 허용, 중복 없음', () => {
    expect(AUTO_REGISTER_REVIEW_PASS_IDS).toHaveLength(44)
    expect(new Set(AUTO_REGISTER_REVIEW_PASS_IDS).size).toBe(44)
    expect(isAutoRegisterReviewPassed('cmv9jwr9n0i2p1wlkj6ix1gg4')).toBe(true) // #27 pkg-hn-0187 1차 통과
    expect(isAutoRegisterReviewPassed('cmv3r8pvm0b5jd11ek6l83zf7')).toBe(true) // #1 rework2 통과
    expect(isAutoRegisterReviewPassed('cmv2mem8d00q6zmu5bxh2e3v4')).toBe(true) // #13 재압축 후 통과
  })
  it('조건 대기·불합격 상품은 불허', () => {
    expect(isAutoRegisterReviewPassed('cmusembtg005p11e2o6ocpnm5')).toBe(false) // #14 hn-0123 미리보기 대기
    expect(isAutoRegisterReviewPassed('cmvb6vequ1db01wlkggbhpef3')).toBe(false) // #46 라이브 캡처 대기
    expect(isAutoRegisterReviewPassed('cmte6uh2h01b7nd9uabfq24jh')).toBe(false) // #16 slug 없음
    expect(isAutoRegisterReviewPassed('cmv84gbv800071wlk9jkzdjbl')).toBe(false) // #32 hn-0184 불합격
  })
  it('검수 안 된 상품·재검수 대기 상품은 불허', () => {
    expect(isAutoRegisterReviewPassed('new-unreviewed-product')).toBe(false)
  })
  it('보류 사유 표시', () => {
    expect(AUTO_REGISTER_BLOCK_REASON_KO.photo_review_pending).toContain('검수')
    expect(formatAutoRegisterBlockReasons(['photo_review_pending'])).toBe('사진 검수 대기(문과장 통과 전)')
  })
  it('작업은 검수 통과일 때만 registered 로 전환', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/register-auto-photo-register-job.ts'), 'utf8')
    expect(src).toContain('if (gate.ok && reviewPassed) {')
    const flipIdx = src.indexOf("registrationStatus: 'registered'")
    expect(src.indexOf('if (gate.ok && reviewPassed) {')).toBeGreaterThan(-1)
    expect(src.indexOf('if (gate.ok && reviewPassed) {')).toBeLessThan(flipIdx)
    expect(src.match(/registrationStatus: 'registered'/g)?.length).toBe(1)
  })
})
