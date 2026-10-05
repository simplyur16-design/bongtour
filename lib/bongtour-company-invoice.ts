/**
 * 봉투어 회사 인보이스·체크인 바우처 — OTA(Trip.com/Agoda) 영수증 기반 발행 SSOT.
 * 입력 금액 = 최종 합계(이익 가산 없음).
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스 — manifest
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

export type OtaAdminDocumentKind = 'invoice' | 'voucher'

export type OtaReceiptParsedAmount = {
  provider: OtaInvoiceProvider
  bookingRef: string | null
  guestName: string | null
  propertyOrService: string | null
  checkIn: string | null
  checkOut: string | null
  roomType: string | null
  nights: number | null
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
  sourceAmountUsd: number | null
  rateDate: string | null
  usdKrwRate: number | null
  profitMode: OtaInvoiceProfitMode
  profitPercent: number
  profitFixedKrw: number
  profitKrw: number
  totalKrw: number
  company: typeof BONGTOUR_INVOICE_COMPANY
  note: string
}

export type OtaCompanyCheckInVoucherDraft = {
  voucherNumber: string
  issuedAtIso: string
  provider: OtaInvoiceProvider
  bookingRef: string | null
  guestName: string | null
  propertyName: string
  roomType: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  amountUsd: number
  rateDate: string
  effectiveRateDate: string
  usdKrwRate: number
  amountKrw: number
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

  const roomType =
    text.match(/객실\s*(?:타입|유형|종류)?\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/Room\s*(?:Type|Category)?\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    null

  const nightsRaw =
    text.match(/(\d+)\s*(?:박|nights?)/i)?.[1] ||
    text.match(/숙박\s*일수\s*[:：]?\s*(\d+)/)?.[1] ||
    null
  const nights = nightsRaw ? Number(nightsRaw) : null

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
    roomType,
    nights: nights != null && Number.isFinite(nights) && nights > 0 ? nights : null,
    sourceAmountKrw,
    currencyHint,
    rawAmountMatches: [...new Set(matches)].slice(0, 12),
  }
}

/** @deprecated 이익 가산 폐지 — 항상 0. 호환용으로 남김. */
export function computeInvoiceProfitKrw(_args: {
  sourceAmountKrw: number
  mode: OtaInvoiceProfitMode
  percent: number
  fixedKrw: number
}): number {
  return 0
}

export function buildOtaCompanyInvoiceDraft(args: {
  parsed: OtaReceiptParsedAmount
  sourceAmountKrw: number
  /** @deprecated 무시됨 — 입력 금액이 최종 합계 */
  profitMode?: OtaInvoiceProfitMode
  /** @deprecated 무시됨 */
  profitPercent?: number
  /** @deprecated 무시됨 */
  profitFixedKrw?: number
  guestNameOverride?: string | null
  note?: string
  now?: Date
  sourceAmountUsd?: number | null
  rateDate?: string | null
  usdKrwRate?: number | null
}): OtaCompanyInvoiceDraft {
  const now = args.now ?? new Date()
  const source = Math.max(0, Math.round(args.sourceAmountKrw))
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
    sourceAmountUsd:
      args.sourceAmountUsd != null && Number.isFinite(args.sourceAmountUsd)
        ? Math.round(Number(args.sourceAmountUsd) * 100) / 100
        : null,
    rateDate: args.rateDate ?? null,
    usdKrwRate:
      args.usdKrwRate != null && Number.isFinite(args.usdKrwRate) ? Number(args.usdKrwRate) : null,
    profitMode: 'percent',
    profitPercent: 0,
    profitFixedKrw: 0,
    profitKrw: 0,
    totalKrw: source,
    company: BONGTOUR_INVOICE_COMPANY,
    note: String(args.note ?? '').trim(),
  }
}

export function buildOtaCompanyCheckInVoucherDraft(args: {
  parsed: OtaReceiptParsedAmount
  amountUsd: number
  rateDate: string
  effectiveRateDate: string
  usdKrwRate: number
  amountKrw: number
  guestNameOverride?: string | null
  propertyOverride?: string | null
  roomTypeOverride?: string | null
  checkInOverride?: string | null
  checkOutOverride?: string | null
  note?: string
  now?: Date
}): OtaCompanyCheckInVoucherDraft {
  const now = args.now ?? new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 9000 + 1000)
  const propertyName =
    (args.propertyOverride ?? args.parsed.propertyOrService)?.trim() || '숙소'
  return {
    voucherNumber: `BT-VCH-${ymd}-${rand}`,
    issuedAtIso: now.toISOString(),
    provider: args.parsed.provider,
    bookingRef: args.parsed.bookingRef,
    guestName: (args.guestNameOverride ?? args.parsed.guestName)?.trim() || null,
    propertyName,
    roomType: (args.roomTypeOverride ?? args.parsed.roomType)?.trim() || null,
    checkIn: (args.checkInOverride ?? args.parsed.checkIn)?.trim() || null,
    checkOut: (args.checkOutOverride ?? args.parsed.checkOut)?.trim() || null,
    nights: args.parsed.nights,
    amountUsd: Math.round(Math.max(0, Number(args.amountUsd)) * 100) / 100,
    rateDate: args.rateDate,
    effectiveRateDate: args.effectiveRateDate,
    usdKrwRate: Number(args.usdKrwRate),
    amountKrw: Math.max(0, Math.round(args.amountKrw)),
    company: BONGTOUR_INVOICE_COMPANY,
    note: String(args.note ?? '').trim(),
  }
}

export function formatKrw(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

export function formatUsd(n: number): string {
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 인쇄용 HTML (관리자 미리보기·window.print) */
export function renderOtaCompanyInvoiceHtml(draft: OtaCompanyInvoiceDraft): string {
  const c = draft.company
  const guest = draft.guestName || '고객'
  const issued = new Date(draft.issuedAtIso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const fxLine =
    draft.sourceAmountUsd != null && draft.usdKrwRate != null && draft.rateDate
      ? `<p class="muted">${formatUsd(draft.sourceAmountUsd)} · 환율 ${draft.rateDate} 기준 1 USD = ${draft.usdKrwRate.toLocaleString('ko-KR')} KRW</p>`
      : ''
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
  <p style="margin-top:20px"><strong>청구 대상</strong> ${escapeHtml(guest)}</p>
  <p class="muted">예약번호 ${escapeHtml(draft.bookingRef || '—')} · 공급원 ${draft.provider}</p>
  ${fxLine}
  <table>
    <thead><tr><th>내역</th><th class="num">금액</th></tr></thead>
    <tbody>
      <tr><td>${escapeHtml(draft.serviceDescription)}</td><td class="num">${formatKrw(draft.sourceAmountKrw)}</td></tr>
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

/** 봉투어 스타일 체크인 바우처 HTML */
export function renderOtaCompanyCheckInVoucherHtml(draft: OtaCompanyCheckInVoucherDraft): string {
  const c = draft.company
  const guest = draft.guestName || 'GUEST'
  const issued = new Date(draft.issuedAtIso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const nightsLabel = draft.nights != null ? `${draft.nights}박` : '—'
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${draft.voucherNumber}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#111;margin:40px;max-width:720px}
  .brand{letter-spacing:0.04em;font-size:13px;color:#444;text-transform:uppercase}
  h1{font-size:24px;margin:6px 0 4px}
  .muted{color:#555;font-size:13px}
  .box{border:1px solid #222;padding:20px;margin-top:20px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #eee}
  .row:last-child{border-bottom:0}
  .k{color:#555;font-size:12px;min-width:120px}
  .v{font-weight:600;text-align:right;flex:1}
  .amount{margin-top:20px;padding:16px;background:#f6f6f6}
  .footer{margin-top:28px;font-size:12px;color:#666;line-height:1.5}
  @media print{body{margin:16px}}
</style>
</head>
<body>
  <div class="brand">${escapeHtml(c.brandName)}</div>
  <h1>${escapeHtml(c.legalName)} 체크인 바우처</h1>
  <div class="muted">${escapeHtml(draft.voucherNumber)} · 발행 ${escapeHtml(issued)}</div>
  <div class="box">
    <div class="row"><div class="k">투숙객</div><div class="v">${escapeHtml(guest)}</div></div>
    <div class="row"><div class="k">숙소</div><div class="v">${escapeHtml(draft.propertyName)}</div></div>
    <div class="row"><div class="k">객실</div><div class="v">${escapeHtml(draft.roomType || '—')}</div></div>
    <div class="row"><div class="k">체크인</div><div class="v">${escapeHtml(draft.checkIn || '—')}</div></div>
    <div class="row"><div class="k">체크아웃</div><div class="v">${escapeHtml(draft.checkOut || '—')}</div></div>
    <div class="row"><div class="k">숙박</div><div class="v">${escapeHtml(nightsLabel)}</div></div>
    <div class="row"><div class="k">예약번호</div><div class="v">${escapeHtml(draft.bookingRef || '—')}</div></div>
  </div>
  <div class="amount">
    <div><strong>결제/표기 금액</strong> ${formatUsd(draft.amountUsd)}</div>
    <div class="muted" style="margin-top:6px">환율일 ${escapeHtml(draft.rateDate)}${
      draft.effectiveRateDate !== draft.rateDate
        ? ` (고시 ${escapeHtml(draft.effectiveRateDate)})`
        : ''
    } · 1 USD = ${draft.usdKrwRate.toLocaleString('ko-KR')} KRW</div>
    <div style="margin-top:8px;font-size:18px;font-weight:700">${formatKrw(draft.amountKrw)}</div>
    <div class="muted" style="margin-top:8px">본 바우처는 ${escapeHtml(c.legalName)} 예약 확인용입니다. 호텔 프론트에 제시해 주세요.</div>
  </div>
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
