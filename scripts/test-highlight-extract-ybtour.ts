/**
 * 로컬 검수: npx tsx scripts/test-highlight-extract-ybtour.ts (노랑풍선 · 여행포인트)
 */
import { extractHighlightFromYbtour } from '../lib/extract-highlight-ybtour'

const sample = `
여행포인트
✔ 체크 항목 하나
✓ 두 번째 항목
- 세 번째 불릿

■ 포함사항
무시할 구역
`

console.log(extractHighlightFromYbtour(sample))
