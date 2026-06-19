import './load-env-for-scripts'
import { collectModetourPriceInputsWithE2eFallback } from '@/lib/modetour-price-collect'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

async function main() {
  const from = kstTodayYmd()
  const to = addDaysUtcYmd(from, RULE_A_WINDOW_DAYS)
  const out = await collectModetourPriceInputsWithE2eFallback(
    'https://www.modetour.com/package/102323383',
    from,
    to,
    { airHotel: true, originCode: 'ADA920TWB4' },
  )
  console.log(
    JSON.stringify(
      {
        source: out.source,
        apiFailedSd1: out.apiFailedSd1,
        e2eAttempted: out.e2eAttempted,
        inputCount: out.inputs.length,
        inputs: out.inputs,
        resolvedProductNo: out.resolvedProductNo,
        resolvedDetailUrl: out.resolvedDetailUrl,
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
