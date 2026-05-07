/**
 * 로컬 검수: npx tsx scripts/test-highlight-extract-lottetour.ts
 */
import { extractHighlightFromLottetour } from '../lib/extract-highlight-lottetour'

const sample = `
Point 상품포인트
★ 첫 번째 포인트
★ 두 번째 포인트
★ 세 번째 포인트

일정 안내
다음 섹션
`

console.log(extractHighlightFromLottetour(sample))
