/**
 * 모두투어 본문 느슨 항공사 추출 검증.
 *
 *   npx tsx scripts/verify-modetour-airline-loose.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import { extractModetourAirlineMatch } from '../lib/flight-modetour-parser'

function main() {
  const samples: Array<{ raw: string; want: string }> = [
    { raw: '항공사: 대한항공 KE123', want: '대한항공' },
    { raw: '아시아나 OZ101 인천 출발', want: '아시아나항공' },
    { raw: '티웨이항공 TW707', want: '티웨이항공' },
    { raw: '진에어 LJ88', want: '진에어' },
    { raw: 'ANA NH862', want: 'ANA' },
  ]
  for (const { raw, want } of samples) {
    const hit = extractModetourAirlineMatch(raw)
    assert.equal(hit?.normalized, want, raw)
  }
  const none = extractModetourAirlineMatch('숙박 및 일정 안내')
  assert.equal(none, null)

  const h = extractModetourAirlineMatch('대한항공 KE123')
  console.log('[verify-modetour-airline-loose]', {
    extractedAirlineRaw: h?.raw,
    normalizedAirline: h?.normalized,
    usedFallbackAirline: h == null,
  })
  console.log('verify-modetour-airline-loose.ts OK')
}

main()
