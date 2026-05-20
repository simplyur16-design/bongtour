const KST = 'Asia/Seoul'

/** 운영자 알림·이메일용 접수 시각 (한국 표준시) */
export function formatInquiryTimestampKst(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return String(iso)

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value?.replace(/\./g, '').trim() ?? ''

  const y = get('year')
  const mo = get('month')
  const day = get('day')
  const wd = get('weekday')
  const hour = get('hour')
  const minute = get('minute')
  const dayPeriod = get('dayPeriod')

  if (!y) return d.toISOString()
  return `${y}.${mo}.${day} (${wd}) ${dayPeriod} ${hour}:${minute} KST`
}

/** 관리자 LMS 한 줄용 짧은 시각 */
export function formatInquiryTimestampKstShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
