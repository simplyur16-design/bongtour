/**
 * REGRESSION-FREEZE[lottetour-register-godid-hokkaido-live-gate]: manifest
 * evtList(godId만) → evtCd resolve → register-facts·parse 실증.
 * npx tsx scripts/verify-register-lottetour-godid-hokkaido-live-gate.ts
 */
import { parseLottetourRegisterFromApi } from '@/lib/lottetour-register-api-parse'
import { resolveLottetourRegisterOriginIdsFromUrl } from '@/lib/lottetour-register-api-detail'

const ORIGIN_URL = 'https://www.lottetour.com/evtList/826/856/1034/1926?godId=66176'

async function main() {
  const ids = await resolveLottetourRegisterOriginIdsFromUrl(ORIGIN_URL)
  if (!ids.godId || !ids.evtCd) {
    throw new Error(`evtCd resolve failed: godId=${ids.godId ?? '-'} evtCd=${ids.evtCd ?? '-'}`)
  }

  const parsed = await parseLottetourRegisterFromApi('', 'lottetour', { originUrl: ORIGIN_URL })
  const scheduleLen = parsed.schedule?.length ?? 0
  const priceLen = parsed.prices?.length ?? 0
  const inclLen = parsed.includedItems?.length ?? 0
  const exclLen = parsed.excludedItems?.length ?? 0

  if (!parsed.title?.trim()) throw new Error('title empty')
  if (scheduleLen < 3) throw new Error(`schedule too short: ${scheduleLen}`)
  if (inclLen < 2) throw new Error(`includedItems too short: ${inclLen}`)
  if (exclLen < 1) throw new Error(`excludedItems empty`)
  if (priceLen < 1) throw new Error(`prices empty: ${priceLen}`)

  console.log('OK lottetour godId=66176 Hokkaido live gate', {
    godId: ids.godId,
    evtCd: ids.evtCd,
    title: parsed.title.slice(0, 72),
    scheduleDays: scheduleLen,
    priceRows: priceLen,
    included: inclLen,
    excluded: exclLen,
    airlineName: parsed.airlineName ?? null,
    outboundFlightNo: parsed.outboundFlightNo ?? null,
    detailCollect: parsed.lottetourDetailCollectSummary ?? null,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
