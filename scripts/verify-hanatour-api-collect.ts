import './load-env-for-scripts'
import { collectHanatourApiDepartureInputsForMonths } from '@/lib/hanatour-api-departures'

async function main() {
  const cases = [
    { label: 'package', pkgCd: 'ATP207260601TWJ', months: ['2026-06', '2026-07'] },
    { label: 'airtel', pkgCd: 'AAB261260706FDB', months: ['2026-07'] },
  ] as const

  for (const c of cases) {
    const out = await collectHanatourApiDepartureInputsForMonths(c.pkgCd, c.months)
    console.log(
      JSON.stringify(
        {
          label: c.label,
          pkgCd: c.pkgCd,
          airtelLike: out.airtelLike,
          count: out.inputs.length,
          sample: out.inputs.slice(0, 3),
        },
        null,
        2,
      ),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
