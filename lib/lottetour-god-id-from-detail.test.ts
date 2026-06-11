import { describe, expect, it } from 'vitest'
import {
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import { parseLottetourGodIdFromBlob } from '@/lib/lottetour-paste-deterministic-patch'

const TURKEY_EVT_DETAIL =
  'https://lottetour.com/evtDetail/826/854/1005/1746?evtCd=E04A260626KE002#n'

describe('parseLottetourGodIdFromBlob', () => {
  it('extracts godId from evtDetail inline script m_GodId', () => {
    const html = `<script>var m_GodId = '60232';</script>`
    expect(parseLottetourGodIdFromBlob(html)).toBe('60232')
  })

  it('extracts godId from evtList query URL', () => {
    const url =
      'https://www.lottetour.com/evtList/826/854/1005/1746?godId=60232&depDt=202606'
    expect(parseLottetourGodIdFromBlob(url)).toBe('60232')
  })
})

describe('parseLottetourEvtListCollectionHints + enrich from detail', () => {
  it('parses menuNos from evtDetail URL without godId', () => {
    const hints = parseLottetourEvtListCollectionHints({
      originUrl: TURKEY_EVT_DETAIL,
      rawMeta: null,
    })
    expect(hints.menuNos).toEqual(['826', '854', '1005', '1746'])
    expect(hints.detailEvtCd).toBe('E04A260626KE002')
    expect(hints.godId).toBeNull()
    expect(hints.warnings.some((w) => w.includes('godId 없음'))).toBe(true)
  })

  it('enriches godId from mocked evtDetail HTML', async () => {
    const base = parseLottetourEvtListCollectionHints({
      originUrl: TURKEY_EVT_DETAIL,
      rawMeta: null,
    })
    const enriched = await enrichLottetourEvtListCollectionHintsFromDetailPage(base, TURKEY_EVT_DETAIL, {
      fetchImpl: async () =>
        new Response(`<html><script>var m_GodId = '60232';</script></html>`, { status: 200 }),
    })
    expect(enriched.godId).toBe('60232')
    expect(enriched.warnings.some((w) => w.includes('godId 없음'))).toBe(false)
  })
})
