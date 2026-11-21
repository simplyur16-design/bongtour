import { describe, expect, it } from 'vitest'
import { HanjintourBlockedError, type HanjintourClient } from '@/lib/hanjintour-http'
import { runHanjintourIngestPending } from '../scripts/hanjintour-ingest-pending'

function client(): HanjintourClient {
  const call = async (part: string) => {
    if (part === 'gnb') {
      return {
        gnbMenuListVoList: [
          { dspCtgNo: 'P', uprDspCtgNo: '', tmplFlnm: '', dspCtgPath: '패키지여행', ctgLvVal: 1 },
          { dspCtgNo: 'L1', uprDspCtgNo: 'P', tmplFlnm: '/dp/display/displayList', dspCtgPath: '패키지여행>유럽>몰타', ctgLvVal: 3 },
        ],
      }
    }
    if (part === 'list') {
      return { result: true, goodsList: [{ gdsNo: 'KWWEU0048', gdsNm: '몰타 일주 4일' }], totalCnt: 1 }
    }
    if (part === 'calendar') {
      return { result: true, eventCalendarList: [{ evtNo: 'OP1', tofDe: '20270321', adltFare: 1990000, tktrrDstgNm: '예약가능' }] }
    }
    if (part === 'event') return { result: true, eventList: [] }
    if (part === 'schedule') return { result: true, eventScheduleDayList: [], tripList: [], descList: [], lodgList: [] }
    throw new Error(part)
  }
  return { call, log: [], isBlocked: () => false, callCount: () => 0 } as HanjintourClient
}

describe('hanjintour ingest pending', () => {
  it('does not record when --apply is absent', async () => {
    let writes = 0
    const summary = await runHanjintourIngestPending({
      client: client(),
      loadExistingRows: async () => [],
      apply: false,
      limit: 5,
      now: new Date('2026-11-15T00:00:00Z'),
      register: async () => {
        writes++
        return { body: { success: true } }
      },
    })
    expect(writes).toBe(0)
    expect(summary.applied).toBe(0)
    expect(summary.planned).toBe(1)
    expect(summary.gdsNos).toEqual(['KWWEU0048'])
    expect(summary.held).toBe(0)
    expect(summary.excluded).toBe(0)
    expect(summary.stoppedReason).toBeNull()
  })

  it('403이면 다음 분류를 읽지 않고 사유만 남긴다', async () => {
    let calls = 0
    const blocking = {
      call: async (part: string) => {
        calls++
        if (part === 'gnb') {
          return {
            gnbMenuListVoList: [
              { dspCtgNo: 'P', uprDspCtgNo: '', tmplFlnm: '', dspCtgPath: '패키지여행', ctgLvVal: 1 },
              { dspCtgNo: 'L1', uprDspCtgNo: 'P', tmplFlnm: '/dp/display/displayList', dspCtgPath: '패키지여행>유럽>몰타', ctgLvVal: 3 },
              { dspCtgNo: 'L2', uprDspCtgNo: 'P', tmplFlnm: '/dp/display/displayList', dspCtgPath: '패키지여행>유럽>아이슬란드', ctgLvVal: 3 },
            ],
          }
        }
        throw new HanjintourBlockedError(403, part)
      },
      log: [],
      isBlocked: () => false,
      callCount: () => calls,
    } as HanjintourClient
    const summary = await runHanjintourIngestPending({
      client: blocking,
      loadExistingRows: async () => [],
      apply: false,
      limit: 5,
      now: new Date('2026-11-15T00:00:00Z'),
    })
    expect(summary.stoppedReason).toBe('blocked_403')
    expect(summary.applied).toBe(0)
    expect(calls).toBe(2)
  })

  it('지역 색인 읽기는 한 번 실패하면 한 번만 다시 한다', async () => {
    let reads = 0
    const summary = await runHanjintourIngestPending({
      client: client(),
      loadExistingRows: async () => {
        reads++
        if (reads === 1) throw new Error('closed')
        return []
      },
      apply: false,
      limit: 5,
      now: new Date('2026-11-15T00:00:00Z'),
    })
    expect(reads).toBe(2)
    expect(summary.stoppedReason).toBeNull()
    expect(summary.planned).toBe(1)
  })
})
