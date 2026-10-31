/**
 * day-label-keep-selection-1031 — 캡션 선택은 기존 그대로, 잘린 「로」 끝 지명만 표시 복원.
 */
import { describe, expect, it } from 'vitest'
import { composeScheduleImageSeoTitleKr, restoreRoEndingPlaceName } from '@/lib/schedule-image-seo-title-ssot'

const c = (routeText: string, day = 2) => composeScheduleImageSeoTitleKr({ day, maxDay: 9, routeText })

describe('composeScheduleImageSeoTitleKr — 선택 유지 + 「로」 지명 표시 복원', () => {
  it('yb-0034 D8 카이로 - 기자 - 카이로 → 카이로 (기존 카이)', () => {
    expect(c('카이로 - 기자 - 카이로', 8)).toBe('카이로')
  })
  it('yb-0034 다른 일차는 기존 선택 그대로', () => {
    expect(c('인천 - 이스탄불 - 카이로', 1)).toBe('이스탄불')
    expect(c('카이로 - 아스완', 2)).toBe('아스완')
    expect(c('아스완 - 아부심벨 - 콤옴보', 3)).toBe('아스완')
    expect(c('룩소르 - 후르가다', 5)).toBe('룩소르')
    expect(c('후르가다 - 카이로', 7)).toBe('후르가다')
  })
  it('routeText 에 원래 이름이 없으면 복원하지 않음 (저장값 자체가 카이)', () => {
    expect(c('후루가다 - 카이 - CAIRO', 9)).toBe('후루가다')
    expect(restoreRoEndingPlaceName('카이', '카이 - 암만')).toBe('카이')
  })
  it('allowlist 아닌 조사 제거는 그대로 (시내로 → 시내 복원 안 함)', () => {
    expect(restoreRoEndingPlaceName('시내', '시내로 이동')).toBe('시내')
    expect(restoreRoEndingPlaceName('파리', '파리로')).toBe('파리')
  })
  it('원래 구간 문자열이 지명 그대로일 때만 복원 — 추측·완성 금지', () => {
    // `카이로로 이동` 구간은 지명 문자열 그대로가 아님 → 복원하지 않음
    expect(restoreRoEndingPlaceName('카이', '카이로로 이동')).toBe('카이')
    expect(restoreRoEndingPlaceName('카이', '카이로 이동')).toBe('카이')
    // routeText 에 원래 구간이 없으면 그대로
    expect(restoreRoEndingPlaceName('카이', '기자 - 아스완')).toBe('카이')
  })
  it('allowlist 지명 복원 (원래 구간 그대로)', () => {
    expect(restoreRoEndingPlaceName('카이', '카이로 - 기자 - 카이로')).toBe('카이로')
    expect(restoreRoEndingPlaceName('비스트', 'T 갤러리아 - 비스트로 - PIC 괌')).toBe('비스트로')
    expect(restoreRoEndingPlaceName('모지코 레트', '아카마 신궁 - 모지코 레트로')).toBe('모지코 레트로')
    expect(restoreRoEndingPlaceName('아스완', '카이로 - 아스완')).toBe('아스완')
  })
})
