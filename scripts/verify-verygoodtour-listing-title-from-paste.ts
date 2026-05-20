/**
 * 참좋은여행 상품명·목적지 붙여넣기 추출 회귀 (E2E 무관).
 * npx tsx scripts/verify-verygoodtour-listing-title-from-paste.ts
 */
import {
  extractVerygoodDestinationFromBracketTitle,
  extractVerygoodtourVerbatimListingTitleFromPaste,
  isVerygoodtourPolicyBracketDestination,
} from '../lib/verygoodtour-listing-title-from-paste'

const GOOD_TITLE =
  '[치앙마이/치앙라이] #골든 트라이앵글 #도이수텝 #전신마사지 60분 #북부대표코스'
const BAD_CHROME =
  '3박5일이스타항공 출도착시간은 현지시각기준이면 상공스캐쥴은 정부인가 조거 ..... 출발일변경'

const PASTE = `${GOOD_TITLE}
3박5일
3박5일
이스타항공
쇼핑
쇼핑 3 회
${BAD_CHROME}
1일차
2026년 05월 21일 (목)
`

function main() {
  const title = extractVerygoodtourVerbatimListingTitleFromPaste(PASTE)
  const dest = extractVerygoodDestinationFromBracketTitle(title ?? '')

  const errors: string[] = []
  if (title !== GOOD_TITLE) errors.push(`title: expected bracket+hash line, got ${JSON.stringify(title)}`)
  if (title?.includes('출도착')) errors.push('title must not be airline chrome')
  if (dest !== '치앙마이 · 치앙라이') errors.push(`dest: got ${JSON.stringify(dest)}`)

  if (extractVerygoodtourVerbatimListingTitleFromPaste(BAD_CHROME)) {
    errors.push('chrome-only line must not win as title')
  }

  const policyTitle = '[노쇼핑, 노업션, 노팁] 규슈 4일 #온천의 진수'
  if (!isVerygoodtourPolicyBracketDestination('노쇼핑, 노업션, 노팁')) {
    errors.push('policy bracket must be detected')
  }
  if (extractVerygoodDestinationFromBracketTitle(policyTitle) != null) {
    errors.push('policy-only bracket must not become destination')
  }

  if (errors.length) {
    console.error('FAIL:', errors.join('; '))
    process.exit(1)
  }
  console.log('OK: verygoodtour listing title from paste')
}

main()
