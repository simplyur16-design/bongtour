/**
 * 상품코드 resolve 실측 — QJP601RFR3 stale 단체번호 107583021 → 현행 107583036
 * npx tsx scripts/verify-modetour-origin-code-resolve.ts [originCode]
 */
import './load-env-for-scripts'
import { resolveModetourDetailByOriginCode } from '@/lib/modetour-origin-code-resolve'
import { collectModetourApiDepartureInputs } from '@/lib/modetour-price-collect'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

async function main() {
  const code = process.argv[2]?.trim() || 'QJP601RFR3'
  const staleUrl = process.argv[3]?.trim() || 'https://www.modetour.com/package/107583021'

  const resolved = await resolveModetourDetailByOriginCode(code, { storedOriginUrl: staleUrl })
  const from = kstTodayYmd()
  const to = addDaysUtcYmd(from, RULE_A_WINDOW_DAYS)

  let staleApi = { priced: 0, error: null as string | null }
  let freshApi = { priced: 0, error: null as string | null }

  try {
    const stale = await collectModetourApiDepartureInputs(staleUrl, from, to)
    staleApi.priced = stale.inputs.length
  } catch (e) {
    staleApi.error = e instanceof Error ? e.message.slice(0, 200) : String(e)
  }

  if (resolved.detailUrl) {
    try {
      const fresh = await collectModetourApiDepartureInputs(resolved.detailUrl, from, to)
      freshApi.priced = fresh.inputs.length
    } catch (e) {
      freshApi.error = e instanceof Error ? e.message.slice(0, 200) : String(e)
    }
  }

  console.log(
    JSON.stringify(
      {
        originCode: code,
        staleUrl,
        resolved,
        apiCompare: { staleUrl: staleApi, resolvedUrl: freshApi },
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
