/**
 * 로컬 검수: npx tsx scripts/test-highlight-extract-hanatour.ts
 */
import { extractHighlightFromHanatour } from '../lib/extract-highlight-hanatour'

const sample = `
📌 상품 핵심 포인트
하나팩 세이브
- 포인트 첫 줄입니다 <a href="#point01">링크</a>
• 두 번째 줄
※ 세 번째 줄

■ 다른 섹션
내용
`

console.log(extractHighlightFromHanatour(sample))
