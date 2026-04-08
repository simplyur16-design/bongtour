/**
 * LLM 기반 지능형 셀렉터 — DOM 요약을 주고 다음 클릭할 요소의 CSS Selector 반환
 */

import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

export type SelectorTask =
  | { step: '해외여행'; instruction: string }
  | { step: '국가'; instruction: string; countryName: string }
  | { step: '상품'; instruction: string; productCodeOrTitle: string }
  | { step: '판매상품보기'; instruction: string }
  | { step: '달력'; instruction: string }
  | { step: '다음달'; instruction: string }

/**
 * 페이지 텍스트 요약과 지시를 LLM에 넘기고, 단일 CSS Selector만 반환받는다.
 * 응답 형식: 반드시 한 줄에 "selector: CSS_SELECTOR" 또는 JSON { "selector": "..." }
 */
export async function findSelectorForStep(
  pageSummary: string,
  task: SelectorTask
): Promise<string | null> {
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const instruction = getInstruction(task)

  const prompt = `당신은 웹 페이지에서 특정 요소를 찾는 도우미입니다.
아래 [페이지 텍스트 요약]을 보고, 다음 지시에 맞는 **클릭 가능한 하나의 요소**를 골라라.

[지시]
${instruction}

[페이지 텍스트 요약]
${pageSummary.slice(0, 12000)}

응답 규칙:
1. 반드시 **한 개의 CSS Selector**만 출력하라. 예: a[href*="overseas"], .menu-item, button:has-text("해외여행") 등.
2. 가능하면 짧고 안정적인 selector를 써라 (id, data-*, 링크 href 일부, 클래스).
3. Playwright/Puppeteer에서 document.querySelector()로 사용 가능한 형태만 써라. :has-text() 같은 건 사용하지 마라.
4. 정말 찾을 수 없으면 "NOT_FOUND" 한 단어만 출력하라.

출력 (한 줄):`

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const text = result.response.text()?.trim() ?? ''
  const lower = text.toLowerCase()
  if (lower === 'not_found' || lower === 'not found') return null
  const selectorMatch = text.match(/selector:\s*([^\s].+)/i) || text.match(/"selector"\s*:\s*"([^"]+)"/)
  if (selectorMatch) return selectorMatch[1].trim()
  const singleLine = text.split('\n')[0].trim()
  if (singleLine.length > 0 && singleLine.length < 500) return singleLine
  return null
}

function getInstruction(task: SelectorTask): string {
  if (task.step === '해외여행') return task.instruction
  if (task.step === '국가') return `"${task.countryName}" 텍스트를 포함한 링크나 버튼을 하나 골라라. (예: 일본-오사카, 동남아-다낭)`
  if (task.step === '상품') return `상품코드 또는 제목에 "${task.productCodeOrTitle}"가 포함된 링크를 하나 골라라.`
  if (task.step === '판매상품보기') return task.instruction
  if (task.step === '다음달') return task.instruction
  return task.instruction
}

function parseSelectorFromResponse(text: string): string | null {
  const lower = text.toLowerCase()
  if (lower === 'not_found' || lower === 'not found') return null
  const selectorMatch = text.match(/selector:\s*([^\s].+)/i) || text.match(/"selector"\s*:\s*"([^"]+)"/)
  if (selectorMatch) return selectorMatch[1].trim()
  const singleLine = text.split('\n')[0].trim()
  if (singleLine.length > 0 && singleLine.length < 500) return singleLine
  return null
}

/**
 * 버튼 식별 실패 시 화면 base64를 LLM에 전달하여 재시도 (최대 3회용).
 * 이미지가 있으면 이미지+텍스트로 selector 추출.
 */
export async function findSelectorWithImage(
  pageSummary: string,
  task: SelectorTask,
  base64Image?: string
): Promise<string | null> {
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const instruction = getInstruction(task)
  const textPart = `[페이지 텍스트 요약]\n${pageSummary.slice(0, 8000)}\n\n[지시]\n${instruction}\n\n응답: 반드시 한 개의 CSS Selector만 한 줄로 출력. document.querySelector() 가능한 형태. 없으면 NOT_FOUND.`

  if (base64Image) {
    const result = await model.generateContent(
      [
        { inlineData: { mimeType: 'image/png', data: base64Image } },
        { text: '현재 브라우저 화면입니다. 지시에 맞는 클릭할 요소의 CSS selector를 알려주세요.' },
        textPart,
      ],
      geminiTimeoutOpts()
    )
    const text = result.response.text()?.trim() ?? ''
    return parseSelectorFromResponse(text)
  }
  return findSelectorForStep(pageSummary, task)
}
