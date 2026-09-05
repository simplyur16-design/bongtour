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
    expect(desc).toMatch(/알마티|침블락|초원|협곡|스케일/)
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
    expect(desc).toMatch(/프라하|카를교/)
  })

  it('크로아티아 플리트비체 — adriatic vibe (lottetour 표에 없을 때)', () => {
    const desc = composeRegisterScheduleRegionVibeDescription({
      day: 4,
      maxDay: 10,
      routePlaces: ['플리트비체', '자다르'],
      joinedBlob: '플리트비체 국립공원 - 자다르',
    })
    expect(desc).toMatch(/플리트비체|자다르|국립공원|풍경|시야/)
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
    expect(greece).toMatch(/메테오라|유적|델피|아라호바/)

    const nordic = composeRegisterScheduleRegionVibeDescription({
      day: 6,
      maxDay: 12,
      routePlaces: ['오르후스', '오덴세'],
      joinedBlob: '오르후스 - 오덴세',
    })
    expect(isRegisterScheduleGenericTourismDescription(nordic!)).toBe(false)
    expect(nordic).toMatch(/오르후스|오덴세/)

    const central = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 9,
      routePlaces: ['아프로시압'],
      joinedBlob: '아프로시압 박물관 - 울루그벡 천문대 - 구르 아미르 묘소',
    })
    expect(isRegisterScheduleGenericTourismDescription(central!)).toBe(false)
    expect(central).toMatch(/아프로시압|울루그벡|박물관|유적/)
  })

  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: Hong Kong before japan kyushu — manifest
  it('홍콩 미드레벨에스컬레이터·란타우 — 규슈/generic 금지', () => {
    const core = composeRegisterScheduleRegionVibeDescription({
      day: 1,
      maxDay: 4,
      routePlaces: ['홍콩', '헐리우드로드', '미드레벨에스컬레이터', '소호거리', '타이쿤'],
      joinedBlob: '홍콩 - 헐리우드로드 - 미드레벨에스컬레이터 - 소호거리 - 타이쿤 - 빅토리아 피크트램 (편도)',
    })
    expect(core).toBeTruthy()
    expect(isRegisterScheduleGenericTourismDescription(core!)).toBe(false)
    expect(core).not.toMatch(/규슈|온천·강변/)
    expect(core).toMatch(/헐리우드|소호|피크|전망|홍콩/)

    const disney = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 4,
      routePlaces: ['란타우섬', '홍콩 디즈니랜드'],
      joinedBlob: '란타우섬 - 홍콩 디즈니랜드',
    })
    expect(disney).toBeTruthy()
    expect(isRegisterScheduleGenericTourismDescription(disney!)).toBe(false)
    expect(disney).not.toMatch(/규슈|하루 동안 여러 장면/)
    expect(disney).toMatch(/디즈니|란타우|테마파크/)

    const kyushu = composeRegisterScheduleRegionVibeDescription({
      day: 2,
      maxDay: 4,
      routePlaces: ['벳푸', '유후인'],
      joinedBlob: '벳푸 - 유후인 - 후쿠오카',
    })
    // REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]: 규슈는 지역 템플릿 또는 벳푸·유후인 명소 문장 — manifest
    expect(kyushu).toMatch(/규슈|온천|항구|벳푸|유후인/)
  })

  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: place leak must not downgrade to generic — manifest
  it('홍콩·푸꾸옥·융프라우 — place leak에도 generic 금지', () => {
    const hk = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 4,
      routePlaces: ['홍콩', '소호 거리', '빅토리아 피크'],
      joinedBlob: '홍콩 - 소호 거리 - 타이쿤 - 빅토리아 피크',
    })
    expect(hk).toBeTruthy()
    expect(isRegisterScheduleGenericTourismDescription(hk!)).toBe(false)

    const pq = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 5,
      routePlaces: ['푸꾸옥', '그랜드월드'],
      joinedBlob: '푸꾸옥 - 그랜드월드 나이트',
    })
    expect(pq).toMatch(/푸꾸옥|그랜드월드|섬/)
    expect(isRegisterScheduleGenericTourismDescription(pq!)).toBe(false)

    const swiss = composeRegisterScheduleRegionVibeDescription({
      day: 6,
      maxDay: 9,
      routePlaces: ['융프라우', '로마 벤츠'],
      joinedBlob: '융프라우 - 로마 벤츠',
    })
    expect(swiss).toMatch(/융프라우|알프스|호수|설봉|전망/)
    expect(isRegisterScheduleGenericTourismDescription(swiss!)).toBe(false)
    expect(swiss).not.toMatch(/로마의|잉글랜드/)
  })
})
