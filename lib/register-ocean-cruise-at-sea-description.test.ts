import { describe, expect, it } from 'vitest'
import {
  composeOceanCruiseAtSeaDescription,
  extractOceanCruiseOnboardActivityLabels,
  isOceanCruiseAtSeaLandTourDescription,
  isValidOceanCruiseAtSeaDescription,
  normalizeOceanCruiseAtSeaRouteText,
  scrubOceanCruiseAtSeaScheduleRow,
} from '@/lib/register-ocean-cruise-at-sea-description'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import { isBrokenRegisterScheduleDescription } from '@/lib/register-pre-photo-guards'

describe('register-ocean-cruise-at-sea-description', () => {
  it('scrubs trailing CMS garbage from at-sea route', () => {
    // REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]
    expect(normalizeOceanCruiseAtSeaRouteText('전일해상 - 발도르...')).toBe('전일해상')
    expect(normalizeOceanCruiseAtSeaRouteText('바르셀로나 - 마르세유')).toBe('바르셀로나 - 마르세유')
  })

  it('rejects land-tour synthesis and accepts onboard activity copy', () => {
    // REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: 둘러봅니다 금지 — manifest
    expect(
      isOceanCruiseAtSeaLandTourDescription(
        '전일해상을 둘러봅니다. 전일해상에서 주변을 이어서 둘러봅니다.',
      ),
    ).toBe(true)
    expect(
      isValidOceanCruiseAtSeaDescription(
        '전일해상을 둘러봅니다. 전일해상에서 주변을 이어서 둘러봅니다.',
      ),
    ).toBe(false)
    expect(
      isValidOceanCruiseAtSeaDescription(
        '선상에서 전일 항해하며 여유로운 하루를 보냅니다. 공연·스파 등 선내 시설을 이용할 수 있습니다.',
      ),
    ).toBe(true)
  })

  it('extracts onboard activities from supplier hay and composes description', () => {
    const hay = `
전일해상 크루즈는 칼리아리를 향하여 전일 항해합니다.
각종 선상 프로그램 (공연/행사) 참석, 선내 시설 이용 및 자유시간
- 매일 다른 환상적인 무대공연을 즐기실 수 있습니다.
선내 시설 이용과 이벤트 참여에는 유료 서비스가 있을 수 있습니다. (ex. 스파, 카지노, 면세점)
`
    expect(extractOceanCruiseOnboardActivityLabels(hay)).toEqual(
      expect.arrayContaining(['공연', '스파', '카지노', '면세점', '선상 프로그램']),
    )
    const desc = composeOceanCruiseAtSeaDescription({
      haystack: hay,
      existingDescription: '전일해상을 둘러봅니다. 전일해상에서 주변을 이어서 둘러봅니다.',
    })
    expect(isOceanCruiseAtSeaLandTourDescription(desc)).toBe(false)
    expect(desc).toMatch(/선상|선내|항해/)
    expect(desc).toMatch(/공연|스파|카지노/)
  })

  it('heal scrubs at-sea route and replaces land-tour description', () => {
    // REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: 힐 경로 — manifest
    const hay =
      '전일해상 각종 선상 프로그램 (공연/행사) 참석 선내 시설 스파 카지노 면세점'
    const healed = healRegisterPrePhotoSchedule(
      [
        {
          day: 1,
          routeText: '로마',
          imageKeyword: 'Rome',
          description: '로마에 도착합니다. 첫날 이동을 맞춥니다.',
        },
        {
          day: 2,
          routeText: '전일해상 - 발도르...',
          title: '전일해상 · 발도르...',
          imageKeyword: '',
          description: '전일해상을 둘러봅니다. 전일해상에서 주변을 이어서 둘러봅니다.',
        },
        {
          day: 3,
          routeText: '칼리아리',
          imageKeyword: 'Cagliari',
          description: '칼리아리를 둘러봅니다. 구시가지를 이어서 방문합니다.',
        },
      ],
      {
        supplierKey: 'verygoodtour',
        productDestination: '이탈리아 · 남프랑스 · 스페인',
        productTitle: '서부지중해 크루즈 3개국 #코스타 토스카나 호',
        productHaystack: hay,
      },
    )
    const d2 = healed.rows.find((r) => Number(r.day) === 2)!
    expect(d2.routeText).toBe('전일해상')
    expect(String(d2.title)).toBe('전일해상')
    expect(String(d2.imageKeyword ?? '')).toBe('')
    expect(isOceanCruiseAtSeaLandTourDescription(d2.description)).toBe(false)
    expect(isBrokenRegisterScheduleDescription(d2.description, d2.routeText)).toBe(false)
    expect(String(d2.description)).toMatch(/공연|스파|카지노|선상|선내/)
    expect(String(d2.description)).not.toMatch(/내용\s*전체\s*열기/)
  })

  it('scrub helper is idempotent on already-good rows', () => {
    const row = scrubOceanCruiseAtSeaScheduleRow(
      {
        day: 7,
        routeText: '전일해상',
        title: '전일해상',
        description:
          '선상에서 전일 항해하며 여유로운 하루를 보냅니다. 공연·스파 등 선내 시설과 프로그램을 이용할 수 있습니다.',
      },
      '공연 스파',
    )
    expect(row.routeText).toBe('전일해상')
    expect(row.description).toMatch(/공연/)
  })
})
