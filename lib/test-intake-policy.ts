/**
 * 테스트·E2E 성격 상담·예약 접수 식별 (운영 정리용).
 */

export type TestIntakeMatchReason =
  | 'name_prefix'
  | 'test_email'
  | 'e2e_phone'
  | 'inquiry_number_tag'
  | 'test_message'

export function testIntakeNamePatterns(): RegExp[] {
  return [/^e2e\d*-/i, /^e2e$/i, /-travel$/i, /-bus$/i, /-interp$/i, /^테스트/i, /^test\b/i]
}

export function testIntakeEmailPatterns(): RegExp[] {
  return [/@test\.local$/i, /@example\.com$/i, /e2e.*@/i]
}

const E2E_PHONES = new Set(['01088889999', '01077776666', '01099998888'])

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function classifyTestIntake(input: {
  customerOrApplicantName: string
  email: string | null | undefined
  phone: string
  accessionNumber?: string
  message?: string | null
}): { isTest: boolean; reasons: TestIntakeMatchReason[] } {
  const reasons: TestIntakeMatchReason[] = []
  const name = input.customerOrApplicantName.trim()
  if (testIntakeNamePatterns().some((re) => re.test(name))) {
    reasons.push('name_prefix')
  }
  const em = (input.email ?? '').trim()
  if (em && testIntakeEmailPatterns().some((re) => re.test(em))) {
    reasons.push('test_email')
  }
  if (E2E_PHONES.has(normalizePhoneDigits(input.phone))) {
    reasons.push('e2e_phone')
  }
  if (input.accessionNumber?.toUpperCase().includes('E2E')) {
    reasons.push('inquiry_number_tag')
  }
  const msg = (input.message ?? '').trim()
  if (msg && /테스트|test\s*접수|e2e/i.test(msg)) {
    reasons.push('test_message')
  }
  return { isTest: reasons.length > 0, reasons }
}
