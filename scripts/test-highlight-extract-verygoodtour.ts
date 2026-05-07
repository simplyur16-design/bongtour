/**
 * 로컬 검수: npx tsx scripts/test-highlight-extract-verygoodtour.ts (참좋은 · POINT 1–3)
 */
import { extractHighlightFromVerygoodtour } from '../lib/extract-highlight-verygoodtour'

const sample = `
POINT 1
• 첫 블록 한 줄
• 첫 블록 두 줄

POINT 2
1. 두 번째 블록

POINT 3
※ 마지막 블록
`

console.log(extractHighlightFromVerygoodtour(sample))
