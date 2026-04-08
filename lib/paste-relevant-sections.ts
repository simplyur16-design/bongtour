/**
 * 붙여넣기 텍스트에서 "찾아야 할 것만" 추려서 AI 입력을 짧게 만듦.
 * PASTE_EXTRACTION_CHECKLIST 기준: 상품코드·상품명·여행도시·가격·일정·포함불포함 등만 유지.
 */

const HEADER_CHARS = 3200
const FOOTER_CHARS = 2200

/** 한 줄이 추출 대상 키워드/패턴을 포함하면 true */
function isRelevantLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  // 상품코드·상품명·소스
  if (/상품코드|상품명|단체번호|originCode|originSource/i.test(t)) return true
  if (/\b(AVP|ATP)[A-Z0-9]+\b/i.test(t)) return true
  // 여행지·기간·항공
  if (/여행도시|여행지|여행기간|여행핵심|항공|비엣젯|제주항공|대한항공|진에어/i.test(t)) return true
  if (/출발확정|출발일|도시|destination|duration/i.test(t)) return true
  // 가격
  if (/상품가격|성인|아동|유아|원\s*\)|KRW|가격|할인|유류/i.test(t)) return true
  if (/\d{1,3}(,\d{3})*\s*원/.test(t) || /\d+\s*만\s*원/.test(t)) return true
  // 날짜(달력)
  if (/\d{2}\.\d{2}\.\d{2}/.test(t) || /\d{4}-\d{2}-\d{2}/.test(t)) return true
  if (/일요일|월요일|화요일|수요일|목요일|금요일|토요일/.test(t)) return true
  // 일정
  if (/\d일차|일차\s|DAY\s*\d/i.test(t)) return true
  // 포함·불포함·특전
  if (/포함\s*사항|불포함|특전|가이드\s*경비|현지\s*필수/i.test(t)) return true
  // 짧은 숫자+문자 조합(가격 표 한 줄일 가능성)
  if (t.length <= 120 && /[\d,]+/.test(t) && /[가-힣A-Za-z]/.test(t)) return true
  return false
}

/**
 * 전체 붙여넣기에서 체크리스트에 필요한 구간만 남긴 문자열 반환.
 * - 앞쪽 HEADER_CHARS(헤더) + 관련 줄만 + 뒤쪽 FOOTER_CHARS(달력/일정이 끝에 있을 때)
 * - 최대 maxChars.
 */
export function extractRelevantSections(rawText: string, maxChars: number): string {
  const len = rawText.length
  if (len <= maxChars) return rawText

  const lines = rawText.split(/\r?\n/)
  const header = rawText.slice(0, HEADER_CHARS)
  const footer = rawText.slice(-FOOTER_CHARS)

  const relevantLines: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    if (!isRelevantLine(line)) continue
    const key = line.trim().slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    relevantLines.push(line)
  }

  const middle = relevantLines.join('\n')
  let out = header + '\n\n[아래는 추출 대상 구간만]\n' + middle + '\n\n[끝부분]\n' + footer
  if (out.length > maxChars) {
    out = out.slice(0, maxChars)
  }
  return out
}
