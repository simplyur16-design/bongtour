/** DEBUG γ — Q5 (Product full `buildProductDetailPageSelect`) 호출처 식별. 측정 후 revert. */
export function logQ5Trigger(caller: string, productId: string, context: string): void {
  const timestamp = toKstIso(new Date())
  console.log(`[q5-trigger] caller=${caller} productId=${productId} context=${context} timestamp=${timestamp}`)
}

function toKstIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    fractionalSecondDigits: 3,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}.${pick('fractionalSecond')}+09:00`
}
