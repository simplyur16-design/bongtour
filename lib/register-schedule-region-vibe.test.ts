/**
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]
 */
import { describe, expect, it } from 'vitest'
import {
  composeRegisterScheduleRegionVibeDescription,
  isRegisterScheduleGenericTourismDescription,
} from '@/lib/register-schedule-region-vibe'

describe('register schedule region vibe', () => {
  it('detects generic tourism marker', () => {
    expect(
      isRegisterScheduleGenericTourismDescription(
        '하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다.',
      ),
    ).toBe(true)
    expect(isRegisterScheduleGenericTourismDescription('항구 도시와 해변·광장이 이어지는 하루입니다.')).toBe(
      false,
    )
  })

  it('중국 대련·장가계 — 서로 다른 지역 vibe', () => {
    const dalian = composeRegisterScheduleRegionVibeDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['대련', '동관거리'],
      joinedBlob: '대련 - 동관거리 - 연화산',
    })
    const zjj = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 5,
      routePlaces: ['장가계', '천문산'],
      joinedBlob: '장가계 - 천문산 - 원가계',
    })
    expect(dalian).toBeTruthy()
    expect(zjj).toBeTruthy()
    expect(isRegisterScheduleGenericTourismDescription(dalian!)).toBe(false)
    expect(isRegisterScheduleGenericTourismDescription(zjj!)).toBe(false)
    expect(dalian).not.toBe(zjj)
  })

  it('중앙아시아 알마티 — steppe vibe', () => {
    const desc = composeRegisterScheduleRegionVibeDescription({
      day: 2,
      maxDay: 7,
      routePlaces: ['알마티', '침블락'],
      joinedBlob: '알마티 - 침블락 - 차른캐년',
    })
    expect(desc).toMatch(/중앙아시아|초원|협곡|스케일/)
    expect(isRegisterScheduleGenericTourismDescription(desc!)).toBe(false)
  })

  it('유럽 프라하 — lottetour 표 위임 (중간일)', () => {
    const desc = composeRegisterScheduleRegionVibeDescription({
      day: 2,
      maxDay: 8,
      routePlaces: ['프라하 성', '카를교'],
      joinedBlob: '프라하 성 - 카를교 - 프라하',
    })
    expect(desc).toBeTruthy()
    expect(isRegisterScheduleGenericTourismDescription(desc!)).toBe(false)
    expect(desc).toMatch(/프라하|중세|광장|도시|걷는/)
  })

  it('크로아티아 플리트비체 — adriatic vibe (lottetour 표에 없을 때)', () => {
    const desc = composeRegisterScheduleRegionVibeDescription({
      day: 4,
      maxDay: 10,
      routePlaces: ['플리트비체', '자다르'],
      joinedBlob: '플리트비체 국립공원 - 자다르',
    })
    expect(desc).toMatch(/아드리아|크로아티아|국립공원|성벽|바다/)
    expect(isRegisterScheduleGenericTourismDescription(desc!)).toBe(false)
  })

  it('그리스 메테오라·북유럽 오르후스·중앙아 아프로시압 — extended vibe', () => {
    const greece = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 9,
      routePlaces: ['메테오라'],
      joinedBlob: '아라호바 - 델피 유적지 - 메테오라',
    })
    expect(isRegisterScheduleGenericTourismDescription(greece!)).toBe(false)
    expect(greece).toMatch(/지중해|해안|유적|마을|골목/)

    const nordic = composeRegisterScheduleRegionVibeDescription({
      day: 6,
      maxDay: 12,
      routePlaces: ['오르후스', '오덴세'],
      joinedBlob: '오르후스 - 오덴세',
    })
    expect(isRegisterScheduleGenericTourismDescription(nordic!)).toBe(false)
    expect(nordic).toMatch(/북유럽|피오르드|항구|구시가지/)

    const central = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 9,
      routePlaces: ['아프로시압'],
      joinedBlob: '아프로시압 박물관 - 울루그벡 천문대 - 구르 아미르 묘소',
    })
    expect(isRegisterScheduleGenericTourismDescription(central!)).toBe(false)
    expect(central).toMatch(/중앙아시아|초원|협곡|도시/)
  })
})
