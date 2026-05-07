/**
 * D-5-LLM 스모크: 4공급사 LLM 추출기 각각에 짧은 원문 샘플을 넣어 결과를 stdout에 출력합니다.
 * (실제 Gemini 호출 — GEMINI_API_KEY 필요)
 *
 *   npx tsx scripts/smoke-highlight-llm.ts
 */
import './load-env-for-scripts'

import { extractHighlightFromHanatourLLM } from '@/lib/llm-extract-highlight-hanatour'
import { extractHighlightFromModetourLLM } from '@/lib/llm-extract-highlight-modetour'
import { extractHighlightFromVerygoodtourLLM } from '@/lib/llm-extract-highlight-verygoodtour'
import { extractHighlightFromYbtourLLM } from '@/lib/llm-extract-highlight-ybtour'

const SAMPLES: { name: string; raw: string; fn: (t: string) => Promise<unknown> }[] = [
  {
    name: 'modetour',
    raw: `상품 정보 일부
상품 POINT
• 직항 이용으로 이동 편안
• 현지 4성급 호텔 2박
MODE'S EVENT
특가 이벤트 문구…`,
    fn: extractHighlightFromModetourLLM,
  },
  {
    name: 'hanatour',
    raw: `📌 상품 핵심 포인트
- 노쇼핑 정통 관광
- 현지식 1회 포함

하나팩 프리미엄 등급 안내 문구…`,
    fn: extractHighlightFromHanatourLLM,
  },
  {
    name: 'ybtour',
    raw: `여행포인트
✔ 전 일정 노팁·노옵션
✔ 자유일정 반나절 포함
☑ 전용 차량 이동`,
    fn: extractHighlightFromYbtourLLM,
  },
  {
    name: 'verygoodtour',
    raw: `POINT 1 직항편으로 빠른 이동
POINT 2 현지 특식 2회
POINT 3 자유시간 반일`,
    fn: extractHighlightFromVerygoodtourLLM,
  },
]

async function main() {
  if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) {
    console.error('GEMINI_API_KEY 없음 — 스모크 생략')
    process.exitCode = 1
    return
  }

  for (const row of SAMPLES) {
    console.log('\n===', row.name, '===')
    console.log('--- raw sample ---\n', row.raw)
    const out = await row.fn(row.raw)
    console.log('--- llm result ---\n', JSON.stringify(out, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
