/** ProductLiveQuoteCard — 인코딩 깨짐 방지용 표시 문구 SSOT (유니코드 이스케이프) */

export const PRODUCT_LIVE_QUOTE_CARD_COPY = {
  shareSummaryDepartureUnset: '\uBBF8\uC120\uD0DD',
  shareSummaryDeparture: '\uCD9C\uBC1C',
  shareSummaryReturn: '\uADC0\uAD6D',
  collectingBookingHint:
    '\uC608\uC57D \uD655\uC815\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uAE08\uC561 \uD655\uC778\uC774 \uC9C0\uC5F0\uB418\uC5B4\uB3C4 \uC608\uC57D \uC694\uCCAD \uC811\uC218\uB294 \uAC00\uB2A5\uD569\uB2C8\uB2E4.',
  paxSectionTitle: '\uC778\uC6D0',
  perPersonSuffix: '\uC6D0/\uC778',
  paxFootnote:
    '\u00B7 \uC544\uB3D9 \uC694\uAE08\uC740 \uD655\uC778 \uD6C4 \uC548\uB0B4. \uC720\uC544\uB294 \uC88C\uC11D \uBBF8\uBC30\uC815 \uC2DC \uBCC4\uB3C4 \uC694\uAE08.',
  counselSummaryHint:
    '\uC0C1\uD488\u00B7\uCD9C\uBC1C\uC77C\u00B7\uC778\uC6D0 \uC694\uC57D\uC774 \uC0C1\uB2F4 \uCC44\uB110\uB85C \uC804\uB2EC\uB429\uB2C8\uB2E4. \uC804\uD654\uBC88\uD638(\uAD8C\uC7A5)\u00B7\uBB38\uC758 \uB0B4\uC6A9\uC744 \uBCF4\uC644\uD574 \uC8FC\uC138\uC694.',
  counselPasteHint:
    '\uC785\uB825\uCC3D\uC774 \uBE44\uC5B4 \uC788\uC73C\uBA74 \uBCF5\uC0AC\uD55C \uC694\uC57D\uC744 \uBD99\uC5EC \uB123\uC5B4 \uC8FC\uC138\uC694.',
  bookingCta: '\uC608\uC57D \uC2E0\uCCAD',
  paxDecreaseAria: (label: string) => `${label} \uAC10\uC18C`,
  paxIncreaseAria: (label: string) => `${label} \uC99D\uAC00`,
} as const

export function buildProductLiveQuoteShareSummary(input: {
  originCode: string
  destination: string
  duration: string
  airline?: string | null
  selectedDate: string | null
  returnDate: string | null
}): string {
  const { originCode, destination, duration, airline, selectedDate, returnDate } = input
  const c = PRODUCT_LIVE_QUOTE_CARD_COPY
  const dep = selectedDate?.trim() || c.shareSummaryDepartureUnset
  const tail = returnDate?.trim() ? ` · ${c.shareSummaryReturn} ${returnDate}` : ''
  const airlinePart = airline?.trim() ? ` · ${airline.trim()}` : ''
  return `${originCode} · ${destination} · ${duration}${airlinePart} · ${c.shareSummaryDeparture} ${dep}${tail}`
}
