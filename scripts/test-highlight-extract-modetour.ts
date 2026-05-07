/**
 * 로컬 검수: npx tsx scripts/test-highlight-extract-modetour.ts
 */
import { extractHighlightFromModetour } from '../lib/extract-highlight-modetour'

const sample = `
<div>
<h2>상품 POINT</h2>
<ul>
<li>전 일정 노팁·노옵션</li>
<li>특급호텔 2박</li>
</ul>
<p><a href="https://drive.google.com/file/xxx">광고</a></p>
<h2>MODE'S EVENT</h2>
<p>이벤트 내용</p>
</div>
`

console.log(extractHighlightFromModetour(sample))
