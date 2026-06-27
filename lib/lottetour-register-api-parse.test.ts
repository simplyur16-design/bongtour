/**
 * REGRESSION-FREEZE[lottetour-register-api-parse]
 */
import { describe, expect, it } from 'vitest'
import { parseLottetourRegisterFromApi } from './lottetour-register-api-parse'
import { resolveLottetourRegisterOriginIdsFromUrl } from './lottetour-register-api-detail'

describe('lottetour register api parse', () => {
  it('requires originUrl with godId or evtCd', async () => {
    await expect(parseLottetourRegisterFromApi('', 'lottetour', { originUrl: '' })).rejects.toThrow(
      /godId 또는 evtCd/,
    )
    await expect(
      parseLottetourRegisterFromApi('', 'lottetour', {
        originUrl: 'https://www.lottetour.com/evtDetail/826/856/1034/1926',
      }),
    ).rejects.toThrow(/godId 또는 evtCd/)
  })

  it('resolveLottetourRegisterOriginIdsFromUrl — evtDetail URL extracts evtCd without fetch', async () => {
    const ids = await resolveLottetourRegisterOriginIdsFromUrl(
      'https://www.lottetour.com/evtDetail/826/857/1063/2333?evtCd=B30A260707BX016&godId=58808',
    )
    expect(ids.evtCd).toBe('B30A260707BX016')
    expect(ids.godId).toBe('58808')
  })

  it('resolveLottetourRegisterOriginIdsFromUrl — evtList URL extracts godId from query', async () => {
    const ids = await resolveLottetourRegisterOriginIdsFromUrl(
      'https://www.lottetour.com/evtList/826/856/1034/1926?godId=66176',
    )
    expect(ids.godId).toBe('66176')
  })
})
