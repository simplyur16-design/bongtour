/**
 * REGRESSION-FREEZE[register-user-url-batch-live-gate-hard]
 */
import { describe, expect, it } from 'vitest'
import {
  collectRegisterBatch2030MiddleBareCityHardIssues,
  collectRegisterBatchFlightStructuredHardIssues,
  isRegisterBatch2030ProductTitle,
} from '@/lib/register-user-url-batch-live-gate-hard-rules'

describe('register-user-url-batch-live-gate-hard-rules', () => {
  it('detects 2030 titles', () => {
    expect(isRegisterBatch2030ProductTitle('세부 5일 (2030)')).toBe(true)
    expect(isRegisterBatch2030ProductTitle('[2030전용] 보홀 5일')).toBe(true)
    expect(isRegisterBatch2030ProductTitle('세부 5일')).toBe(false)
  })

  it('APP221-like — middle Day2 bare Cebu hard-fails; edges allowed', () => {
    const title =
      '세부 5일 #뫼벤픽 #디럭스 #해적호핑 #정어리떼스노클링 #시라오가든 #레아신전 (2030)'
    expect(
      collectRegisterBatch2030MiddleBareCityHardIssues({
        productTitle: title,
        day: 2,
        maxDay: 5,
        routeText: '세부 해적호핑 - 해적 호핑',
        imageKeyword: 'Cebu',
      }),
    ).toEqual([expect.stringMatching(/bare city.*Cebu/i)])

    expect(
      collectRegisterBatch2030MiddleBareCityHardIssues({
        productTitle: title,
        day: 1,
        maxDay: 5,
        routeText: '세부 입국',
        imageKeyword: 'Cebu',
      }),
    ).toEqual([])

    expect(
      collectRegisterBatch2030MiddleBareCityHardIssues({
        productTitle: title,
        day: 5,
        maxDay: 5,
        routeText: '세부 출발 및 인천 귀국',
        imageKeyword: 'Cebu',
      }),
    ).toEqual([])

    expect(
      collectRegisterBatch2030MiddleBareCityHardIssues({
        productTitle: title,
        day: 2,
        maxDay: 5,
        routeText: '세부 해적호핑',
        imageKeyword: 'Cebu Pirate Island Hopping',
      }),
    ).toEqual([])
  })

  it('non-2030 middle bare city is not hard-failed by this rule', () => {
    expect(
      collectRegisterBatch2030MiddleBareCityHardIssues({
        productTitle: '세부 5일',
        day: 2,
        maxDay: 5,
        routeText: '시내',
        imageKeyword: 'Cebu',
      }),
    ).toEqual([])
  })

  it('flightStructured hard-fails when airline/flightNos missing', () => {
    expect(collectRegisterBatchFlightStructuredHardIssues({})).toEqual([
      expect.stringMatching(/항공 flightStructured 누락/),
    ])
    expect(
      collectRegisterBatchFlightStructuredHardIssues({
        airlineName: '제주항공',
        outboundFlightNo: '7C2501',
        inboundFlightNo: '7C2502',
        detailBodyStructured: {
          flightStructured: {
            airlineName: '제주항공',
            outbound: { flightNo: '7C2501', departureTime: '08:30' },
            inbound: { flightNo: '7C2502', departureTime: '12:55' },
          },
        },
      }),
    ).toEqual([])
  })

  it('legacy r8 APP221 snapshot would hard-fail Day2 bare Cebu + empty flight', () => {
    const title =
      '세부 5일 #뫼벤픽 #디럭스 #해적호핑 #정어리떼스노클링 #전신마사지 #시라오가든 #레아신전 #SM몰자유시간 (2030)'
    const day2 = collectRegisterBatch2030MiddleBareCityHardIssues({
      productTitle: title,
      day: 2,
      maxDay: 5,
      routeText: '세부 해적호핑 - 해적 호핑_손글씨 버전 - 해적 호핑 식사',
      imageKeyword: 'Cebu',
    })
    expect(day2.length).toBeGreaterThan(0)
    expect(collectRegisterBatchFlightStructuredHardIssues({}).length).toBeGreaterThan(0)
  })
})
