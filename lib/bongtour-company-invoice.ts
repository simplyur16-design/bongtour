/**
 * 봉투어 회사 인보이스 — OTA(Trip.com/Agoda) 영수증 기반 발행 SSOT.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스(+이익) — manifest
 */

export const BONGTOUR_INVOICE_COMPANY = {
  legalName: '봉투어',
  brandName: 'BongTour',
  businessRegistrationNo: '255-81-03455',
  tourismRegistrationNo: '2024-0033',
  mailOrderNo: '2024-수원영통-1596',
  phone: '031-213-2558',
  consultHours: '평일 08:00–19:00',
  address: '',
} as const

export type OtaInvoiceProvider = 'trip_com' | 'agoda' | 'unknown'

export type OtaInvoiceProfitMode = 'percent' | 'fixed'

export type OtaReceiptParsedAmount = {
  provider: OtaInvoiceProvider
  bookingRef: string | null
  guestName: string | null
  propertyOrService: string | null
  checkIn: string | null
  checkOut: string | null
  /** 영수증에서 읽은 공급가(원). 파싱 실패 시 null */
  sourceAmountKrw: number | null
  currencyHint: string | null
  rawAmountMatches: string[]
}

export type OtaCompanyInvoiceDraft = {
  invoiceNumber: string
  issuedAtIso: string
  provider: OtaInvoiceProvider
  bookingRef: string | null
  guestName: string | null
  serviceDescription: string
  sourceAmountKrw: number
  profitMode: OtaInvoiceProfitMode
  profitPercent: number
  profitFixedKrw: number
  profitKrw: number
  totalKrw: number
  company: typeof BONGTOUR_INVOICE_COMPANY
  note: string
}

function detectProvider(text: string): OtaInvoiceProvider {
  const lower = text.toLowerCase()
  if (lower.includes('agoda') || text.includes('아고다')) return 'agoda'
  if (lower.includes('trip.com') || lower.includes('ctrip') || text.includes('트립닷컴')) return 'trip_com'
  return 'unknown'
}

function parseMoneyToken(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  // 소수점만 있는 소액(USD 등)은 KRW 가정 시 제외 — 1만 원 미만은 보조 매치로만
  return Math.round(n)
}

/** Trip.com / Agoda 영수증 본문에서 총액·예약번호·숙소 추출 */
export function parseOtaReceiptForInvoice(text: string): OtaReceiptParsedAmount {
  const provider = detectProvider(text)
  const bookingRef =
    text.match(/Booking\s*ID\s*[:：]?\s*(\d{6,})/i)?.[1] ||
    text.match(/예약\s*번호\s*[:：]?\s*(\d{6,})/)?.[1] ||
    text.match(/Order\s*(?:ID|No\.?|Number)\s*[:：]?\s*([A-Z0-9-]{6,})/i)?.[1] ||
    text.match(/확인\s*번호\s*[:：]?\s*([A-Z0-9-]{6,})/)?.[1] ||
    null

  const guestName =
    text.match(/고객명\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/(?:Guest|Traveler|Passenger)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/투숙객\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    null

  const propertyOrService =
    text.match(/숙소명\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/Property\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/Hotel\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/상품명\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    null

  const checkIn =
    text.match(/체크인\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/(?:Check[- ]?in|Arrival)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    null
  const checkOut =
    text.match(/체크아웃\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/(?:Check[- ]?out|Departure)\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    null

  const amountPatterns: RegExp[] = [
    /(?:총\s*(?:결제\s*)?금액|결제\s*금액|합계|총액|Total\s*(?:Amount|Price|Due)?|Grand\s*Total|Amount\s*Paid)\s*[:：]?\s*(?:KRW|₩|￦)?\s*([\d,]+)\s*(?:원|KRW)?/gi,
    /(?:KRW|₩|￦)\s*([\d,]{4,})/g,
    /([\d,]{4,})\s*원/g,
  ]

  const matches: string[] = []
  const candidates: number[] = []
  for (const re of amountPatterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const token = m[1] ?? ''
      matches.push(token)
      const n = parseMoneyToken(token)
      if (n != null && n >= 1000) candidates.push(n)
    }
  }

  // 총액 라벨 근처 최댓값 우선, 없으면 후보 중 최댓값
  let sourceAmountKrw: number | null = null
  if (candidates.length) {
    sourceAmountKrw = Math.max(...candidates)
  }

  const currencyHint = /KRW|₩|￦|원/.test(text)
    ? 'KRW'
    : /USD|\$/.test(text)
      ? 'USD'
      : null

  return {
    provider,
    bookingRef,
    guestName,
    propertyOrService,
    checkIn,
    checkOut,
    sourceAmountKrw,
    currencyHint,
    rawAmountMatches: [...new Set(matches)].slice(0, 12),
  }
}

export function computeInvoiceProfitKrw(args: {
  sourceAmountKrw: number
  mode: OtaInvoiceProfitMode
  percent: number
  fixedKrw: number
}): number {
  const base = Math.max(0, Math.round(args.sourceAmountKrw))
  if (args.mode === 'fixed') {
    return Math.max(0, Math.round(args.fixedKrw))
  }
  const pct = Math.max(0, Math.min(500, Number(args.percent) || 0))
  return Math.round((base * pct) / 100)
}

export function buildOtaCompanyInvoiceDraft(args: {
  parsed: OtaReceiptParsedAmount
  sourceAmountKrw: number
  profitMode: OtaInvoiceProfitMode
  profitPercent: number
  profitFixedKrw: number
  guestNameOverride?: string | null
  note?: string
  now?: Date
}): OtaCompanyInvoiceDraft {
  const now = args.now ?? new Date()
  const source = Math.max(0, Math.round(args.sourceAmountKrw))
  const profitKrw = computeInvoiceProfitKrw({
    sourceAmountKrw: source,
    mode: args.profitMode,
    percent: args.profitPercent,
    fixedKrw: args.profitFixedKrw,
  })
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const serviceParts = [
    args.parsed.propertyOrService,
    args.parsed.checkIn && args.parsed.checkOut
      ? `${args.parsed.checkIn} ~ ${args.parsed.checkOut}`
      : null,
    args.parsed.bookingRef ? `예약 ${args.parsed.bookingRef}` : null,
    args.parsed.provider === 'agoda'
      ? 'Agoda 숙박'
      : args.parsed.provider === 'trip_com'
        ? 'Trip.com 예약'
        : 'OTA 예약',
  ].filter(Boolean)

  return {
    invoiceNumber: `BT-INV-${ymd}-${rand}`,
    issuedAtIso: now.toISOString(),
    provider: args.parsed.provider,
    bookingRef: args.parsed.bookingRef,
    guestName: (args.guestNameOverride ?? args.parsed.guestName)?.trim() || null,
    serviceDescription: serviceParts.join(' · ') || '여행 서비스',
    sourceAmountKrw: source,
    profitMode: args.profitMode,
    profitPercent: args.profitPercent,
    profitFixedKrw: args.profitFixedKrw,
    profitKrw,
    totalKrw: source + profitKrw,
    company: BONGTOUR_INVOICE_COMPANY,
    note: String(args.note ?? '').trim(),
  }
}

export function formatKrw(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 인쇄용 HTML (관리자 미리보기·window.print) */
export function renderOtaCompanyInvoiceHtml(draft: OtaCompanyInvoiceDraft): string {
  const c = draft.company
  const guest = draft.guestName || '고객'
  const issued = new Date(draft.issuedAtIso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const profitLabel =
    draft.profitMode === 'percent'
      ? `회사 이익 (${draft.profitPercent}%)`
      : `회사 이익 (고정)`
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${draft.invoiceNumber}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#111;margin:40px;max-width:720px}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#555;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{border-bottom:1px solid #ddd;padding:10px 6px;text-align:left}
  th{font-size:12px;color:#555}
  td.num,th.num{text-align:right}
  .total{font-weight:700;font-size:16px}
  .footer{margin-top:32px;font-size:12px;color:#666;line-height:1.5}
  @media print{body{margin:16px}}
</style>
</head>
<body>
  <h1>${c.legalName} 인보이스</h1>
  <div class="muted">${c.brandName} · ${draft.invoiceNumber}</div>
  <div class="muted">발행일시 ${issued}</div>
  <p style="margin-top:20px"><strong>청구 대상</strong> ${guest}</p>
  <p class="muted">예약번호 ${draft.bookingRef || '—'} · 공급원 ${draft.provider}</p>
  <table>
    <thead><tr><th>내역</th><th class="num">금액</th></tr></thead>
    <tbody>
      <tr><td>${escapeHtml(draft.serviceDescription)} (공급가)</td><td class="num">${formatKrw(draft.sourceAmountKrw)}</td></tr>
      <tr><td>${profitLabel}</td><td class="num">${formatKrw(draft.profitKrw)}</td></tr>
      <tr class="total"><td>합계</td><td class="num">${formatKrw(draft.totalKrw)}</td></tr>
    </tbody>
  </table>
  ${draft.note ? `<p style="margin-top:16px"><strong>비고</strong> ${escapeHtml(draft.note)}</p>` : ''}
  <div class="footer">
    사업자등록 ${c.businessRegistrationNo} · 관광사업자 ${c.tourismRegistrationNo}호 · 통신판매업 ${c.mailOrderNo}<br/>
    상담 ${c.phone} (${c.consultHours})
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
