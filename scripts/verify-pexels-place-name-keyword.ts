/**
 * SSOT: normalizeToPlaceName 단위 검증
 * 실행: npx tsx scripts/verify-pexels-place-name-keyword.ts
 */
import assert from 'node:assert/strict'
import { normalizeToPlaceName } from '../lib/pexels-place-name-keyword'

const cases: Array<{ in: string; want: string }> = [
  { in: 'Osaka Castle / landmark exterior / street-level view', want: 'Osaka Castle' },
  { in: 'Shibuya crossing Tokyo night', want: 'Shibuya Crossing' },
  { in: 'Shanghai Bund skyline', want: 'The Bund' },
  { in: 'Halong Bay aerial view', want: 'Halong Bay' },
  { in: 'Eiffel Tower Paris', want: 'Eiffel Tower' },
  { in: 'Tokyo Tower', want: 'Tokyo Tower' },
  { in: 'Day 5 travel', want: '' },
  { in: 'Osaka Castle / landmark exterior', want: 'Osaka Castle' },
  { in: 'Osaka', want: 'Osaka' },
]

let failed = 0
for (const { in: input, want } of cases) {
  const got = normalizeToPlaceName(input)
  try {
    assert.equal(got, want, `input=${JSON.stringify(input)}`)
    console.log('OK', input, '→', got || '(empty)')
  } catch (e) {
    failed += 1
    console.error('FAIL', input, 'want', want, 'got', got)
  }
}

if (failed > 0) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log(`\nAll ${cases.length} cases passed.`)
