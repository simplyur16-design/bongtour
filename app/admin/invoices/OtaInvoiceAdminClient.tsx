'use client'
// REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 바우처 클라 — company-invoice만 import(로고 서버 모듈 금지) — manifest

import { useCallback, useEffect, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_CARD_CLASS } from '@/lib/admin-design-system'
import type {
  OtaAdminDocumentKind,
  OtaCompanyAirVoucherDraft,
  OtaCompanyCheckInVoucherDraft,
  OtaCompanyInvoiceDraft,
  OtaReceiptParsedAmount,
} from '@/lib/bongtour-company-invoice'
import {
  breakfastLabel,
  computeVoucherTotalUsdFromNightRate,
  isOtaCompanyAirVoucherDraft,
} from '@/lib/bongtour-company-invoice'

type FxInfo = {
  rateDate: string
  effectiveDate: string
  usdKrw: number
  source: string
}

type SavedInfo = {
  id: string
  documentNumber: string
  fileCount: number
  storageWarnings: string[]
}

type ApiOk = {
  ok: true
  documentKind: OtaAdminDocumentKind
  parsed: OtaReceiptParsedAmount
  fx?: FxInfo
  draft: OtaCompanyInvoiceDraft | OtaCompanyCheckInVoucherDraft | OtaCompanyAirVoucherDraft
  html: string
  htmlKo?: string
  htmlEn?: string
  warning?: string
  airParsed?: {
    passengers: string[]
    pnr: string | null
    ticketNumber: string | null
    bookingRef: string | null
    flights: Array<{ flightNo: string; airline: string | null }>
  }
}

type IssuedListItem = {
  id: string
  documentKind: string
  documentNumber: string
  provider: string | null
  bookingRef: string | null
  guestName: string | null
  propertyName: string | null
  amountUsd: number | null
  amountKrw: number | null
  rateDate: string | null
  createdAt: string
  files: Array<{
    id: string
    role: string
    fileName: string
    mimeType: string
    byteSize: number
  }>
}

function todaySeoulYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  const raw = await res.text()
  if (!raw.trim()) {
    throw new Error(`서버 응답이 비었습니다 (${res.status})`)
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`응답 JSON을 읽지 못했습니다 (${res.status})`)
  }
}

export default function OtaInvoiceAdminClient() {
  const [documentKind, setDocumentKind] = useState<OtaAdminDocumentKind>('voucher')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [guestName, setGuestName] = useState('')
  const [propertyNameKo, setPropertyNameKo] = useState('')
  const [propertyNameEn, setPropertyNameEn] = useState('')
  const [roomType, setRoomType] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [note, setNote] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [nightRateUsd, setNightRateUsd] = useState('')
  const [sourceAmountKrw, setSourceAmountKrw] = useState('')
  const [rateDate, setRateDate] = useState(todaySeoulYmd)
  const [hotelReservationFeeKrw, setHotelReservationFeeKrw] = useState('')
  const [airTicketingFeeKrw, setAirTicketingFeeKrw] = useState('')
  const [travelInsuranceKrw, setTravelInsuranceKrw] = useState('')
  const [visaApplied, setVisaApplied] = useState(false)
  const [visaFeeKrw, setVisaFeeKrw] = useState('')
  const [visaAgencyFeeKrw, setVisaAgencyFeeKrw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<
    OtaCompanyInvoiceDraft | OtaCompanyCheckInVoucherDraft | OtaCompanyAirVoucherDraft | null
  >(    null,
  )
  const [parsed, setParsed] = useState<OtaReceiptParsedAmount | null>(null)
  const [fx, setFx] = useState<FxInfo | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [htmlKo, setHtmlKo] = useState<string | null>(null)
  const [htmlEn, setHtmlEn] = useState<string | null>(null)
  const [savedInfo, setSavedInfo] = useState<SavedInfo | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [history, setHistory] = useState<IssuedListItem[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)

  const reloadHistory = useCallback(async () => {
    setHistoryBusy(true)
    setHistoryError(null)
    try {
      const res = await fetch('/api/admin/invoices/issued?kind=all')
      const json = await readJsonResponse<{
        ok: boolean
        items?: IssuedListItem[]
        error?: string
      }>(res)
      if (!json.ok) throw new Error(json.error || '발행 목록을 불러오지 못했습니다.')
      setHistory(json.items ?? [])
    } catch (e) {
      setHistory([])
      setHistoryError(e instanceof Error ? e.message : String(e))
    } finally {
      setHistoryBusy(false)
    }
  }, [])

  useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

  const openSaved = useCallback(async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/invoices/issued/${id}`)
      const json = await readJsonResponse<{
        ok: boolean
        error?: string
        item?: {
          documentKind: OtaAdminDocumentKind
          documentNumber: string
          issuedHtml: string
          htmlKo: string | null
          htmlEn: string | null
          files?: IssuedListItem['files']
        }
      }>(res)
      if (!json.ok || !json.item) throw new Error(json.error || '문서를 열 수 없습니다.')
      setHtml(json.item.issuedHtml)
      setHtmlKo(json.item.htmlKo)
      setHtmlEn(json.item.htmlEn)
      setDocumentKind(json.item.documentKind)
      setSavedInfo({
        id,
        documentNumber: json.item.documentNumber,
        fileCount: json.item.files?.filter((f) => f.role === 'ota_original').length ?? 0,
        storageWarnings: [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const applyParsedToForm = useCallback((p: OtaReceiptParsedAmount) => {
    if (p.guestName) setGuestName((prev) => prev.trim() || p.guestName || '')
    if (p.propertyNameKo) setPropertyNameKo((prev) => prev.trim() || p.propertyNameKo || '')
    if (p.propertyNameEn) setPropertyNameEn((prev) => prev.trim() || p.propertyNameEn || '')
    if (!p.propertyNameKo && !p.propertyNameEn && p.propertyOrService) {
      setPropertyNameEn((prev) => prev.trim() || p.propertyOrService || '')
    }
    const roomShow = [p.roomTypeKo, p.roomTypeEn].filter(Boolean).join(' / ') || p.roomType
    if (roomShow) setRoomType((prev) => prev.trim() || roomShow)
    const checkInShow = [p.checkInKo, p.checkInEn].filter(Boolean).join(' / ') || p.checkIn
    if (checkInShow) setCheckIn((prev) => prev.trim() || checkInShow)
    const checkOutShow = [p.checkOutKo, p.checkOutEn].filter(Boolean).join(' / ') || p.checkOut
    if (checkOutShow) setCheckOut((prev) => prev.trim() || checkOutShow)
    if (p.nightRateUsd != null) setNightRateUsd(String(p.nightRateUsd))
    const autoTotal = computeVoucherTotalUsdFromNightRate(p.nightRateUsd, p.nights)
    if (p.totalUsd != null) setAmountUsd(String(p.totalUsd))
    else if (autoTotal != null) setAmountUsd(String(autoTotal))
    if (p.sourceAmountKrw != null) setSourceAmountKrw(String(p.sourceAmountKrw))
    if (p.paymentDate) setRateDate(p.paymentDate)
  }, [])

  const parsedNights = parsed?.nights ?? null

  const submit = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('documentKind', documentKind)
      form.set('text', text)
      form.set('rateDate', rateDate || todaySeoulYmd())
      if (guestName.trim()) form.set('guestName', guestName.trim())
      if (propertyNameKo.trim()) form.set('propertyNameKo', propertyNameKo.trim())
      if (propertyNameEn.trim()) form.set('propertyNameEn', propertyNameEn.trim())
      if (propertyNameKo.trim() || propertyNameEn.trim()) {
        form.set(
          'propertyName',
          [propertyNameKo.trim(), propertyNameEn.trim()].filter(Boolean).join(' / '),
        )
      }
      if (note.trim()) form.set('note', note.trim())
      if (documentKind === 'invoice') {
        if (hotelReservationFeeKrw.trim()) {
          form.set('hotelReservationFeeKrw', hotelReservationFeeKrw.trim())
        }
        if (airTicketingFeeKrw.trim()) form.set('airTicketingFeeKrw', airTicketingFeeKrw.trim())
        if (travelInsuranceKrw.trim()) form.set('travelInsuranceKrw', travelInsuranceKrw.trim())
        form.set('visaApplied', visaApplied ? '1' : '0')
        if (visaApplied && visaFeeKrw.trim()) form.set('visaFeeKrw', visaFeeKrw.trim())
        if (visaApplied && visaAgencyFeeKrw.trim()) {
          form.set('visaAgencyFeeKrw', visaAgencyFeeKrw.trim())
        }
      }
      for (const f of files) form.append('file', f)
      const res = await fetch('/api/admin/invoices/from-ota-receipt', { method: 'POST', body: form })
      const json = await readJsonResponse<ApiOk & {
        ok: boolean
        error?: string
        parsed?: OtaReceiptParsedAmount
        fx?: FxInfo
        paymentDateFromOta?: boolean
      }>(res)
      if (json.fx) setFx(json.fx)
      if (json.parsed) {
        setParsed(json.parsed)
        applyParsedToForm(json.parsed)
      }
      if (!json.ok) {
        throw new Error(json.error || '문서 생성 실패')
      }
      setDraft(json.draft)
      setHtml(json.html)
      setHtmlKo(
        json.htmlKo ??
          (json.documentKind === 'voucher' || json.documentKind === 'air_voucher'
            ? json.html
            : null),
      )
      setHtmlEn(json.htmlEn ?? null)
      setSavedInfo(null)
      setSaveError(null)
      if (json.warning) setError(json.warning)
      if (isOtaCompanyAirVoucherDraft(json.draft) && json.draft.guestName) {
        const airGuest = json.draft.guestName
        setGuestName((prev) => prev.trim() || airGuest || '')
      }
      if ('otaStayKrw' in json.draft && json.draft.otaStayKrw != null) {
        setSourceAmountKrw(String(json.draft.otaStayKrw))
      } else if ('sourceAmountKrw' in json.draft && json.draft.sourceAmountKrw) {
        setSourceAmountKrw(String(json.draft.sourceAmountKrw))
      }
      if ('nightRateUsd' in json.draft && json.draft.nightRateUsd != null) {
        setNightRateUsd(String(json.draft.nightRateUsd))
      }
      if ('amountUsd' in json.draft && json.draft.amountUsd != null) {
        setAmountUsd(String(json.draft.amountUsd))
      }
      if ('sourceAmountUsd' in json.draft && json.draft.sourceAmountUsd != null) {
        setAmountUsd(String(json.draft.sourceAmountUsd))
      }
    } catch (e) {
      setDraft(null)
      setHtml(null)
      setHtmlKo(null)
      setHtmlEn(null)
      setSavedInfo(null)
      setSaveError(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [
    documentKind,
    text,
    files,
    guestName,
    propertyNameKo,
    propertyNameEn,
    note,
    rateDate,
    hotelReservationFeeKrw,
    airTicketingFeeKrw,
    travelInsuranceKrw,
    visaApplied,
    visaFeeKrw,
    visaAgencyFeeKrw,
    applyParsedToForm,
  ])

  const archiveAndDownloadPdf = useCallback(
    async (which: 'both' | 'ko' | 'en' = 'both') => {
      const doc =
        which === 'ko' ? htmlKo || html : which === 'en' ? htmlEn || html : html
      if (!doc || !draft || !html || !parsed) {
        setSaveError('미리보기를 먼저 생성하세요.')
        return
      }
      setBusy(true)
      try {
        const form = new FormData()
        form.set('documentKind', documentKind)
        form.set('draftJson', JSON.stringify(draft))
        form.set('parsedJson', JSON.stringify(parsed))
        form.set('issuedHtml', html)
        form.set('pdfScope', which)
        form.set('persist', savedInfo?.id ? '0' : '1')
        if (htmlKo) form.set('htmlKo', htmlKo)
        if (htmlEn) form.set('htmlEn', htmlEn)
        if (text.trim()) form.set('sourceText', text)
        if (note.trim()) form.set('note', note.trim())
        if (!savedInfo?.id) {
          for (const f of files) form.append('file', f)
        }
        const res = await fetch('/api/admin/invoices/issued', { method: 'POST', body: form })
        const json = await readJsonResponse<{
          ok: boolean
          error?: string
          saved?: SavedInfo | null
          pdfBase64?: string
          pdfFileName?: string
        }>(res)
        if (!json.ok || !json.pdfBase64 || !json.pdfFileName) {
          throw new Error(json.error || 'PDF 생성 실패')
        }
        if (json.saved?.id) {
          setSavedInfo(json.saved)
          void reloadHistory()
        }
        setSaveError(null)
        const bin = Uint8Array.from(atob(json.pdfBase64), (c) => c.charCodeAt(0))
        const blob = new Blob([bin], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = json.pdfFileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [
      draft,
      html,
      htmlKo,
      htmlEn,
      parsed,
      savedInfo?.id,
      documentKind,
      text,
      note,
      files,
      reloadHistory,
    ],
  )

  const isVoucher = documentKind === 'voucher'
  const isAirVoucher = documentKind === 'air_voucher'
  const isBilingualVoucher = isVoucher || isAirVoucher
  const invoiceDraft =
    draft && 'invoiceNumber' in draft ? (draft as OtaCompanyInvoiceDraft) : null
  const airVoucherDraft = isOtaCompanyAirVoucherDraft(draft) ? draft : null
  const voucherDraft =
    draft && 'voucherNumber' in draft && !isOtaCompanyAirVoucherDraft(draft)
      ? (draft as OtaCompanyCheckInVoucherDraft)
      : null

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <AdminPageHeader
        title="OTA → 회사 인보이스 / 체크인·항공권 바우처"
        subtitle="체크인 바우처는 OTA Booking ID·숙소·조식이 필요합니다. 항공권 바우처는 항공사 e-ticket(승객·PNR·편명)만 쓰며 OTA 예약번호·OTA 로고/명칭은 필요 없습니다."
      />

      {savedInfo?.id ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          PDF 보관됨 · {savedInfo.documentNumber || savedInfo.id}
          {savedInfo.fileCount > 0 ? ` · OTA 원본 ${savedInfo.fileCount}개` : ''}
          {savedInfo.storageWarnings?.length
            ? ` · 경고: ${savedInfo.storageWarnings.join(', ')}`
            : ''}
        </p>
      ) : null}
      {saveError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          PDF 저장 실패: {saveError}
        </p>
      ) : null}

      <section className={`${ADMIN_CARD_CLASS} space-y-4 p-5`}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDocumentKind('invoice')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              documentKind === 'invoice' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'
            }`}
          >
            인보이스
          </button>
          <button
            type="button"
            onClick={() => setDocumentKind('voucher')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              documentKind === 'voucher' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'
            }`}
          >
            체크인 바우처
          </button>
          <button
            type="button"
            onClick={() => setDocumentKind('air_voucher')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              documentKind === 'air_voucher' ? 'bg-zinc-900 text-white' : 'border border-zinc-300'
            }`}
          >
            항공권 바우처
          </button>
        </div>

        <label className="block text-sm font-medium text-zinc-800">
          {isAirVoucher
            ? '항공사 e-ticket 본문 (승객·편명·PNR 추출용)'
            : 'OTA 바우처/영수증 본문 (예약·숙소 추출용)'}
          <textarea
            className="mt-1 w-full min-h-[160px] rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isAirVoucher
                ? '항공사 e-ticket / Passenger Itinerary 전문을 붙여넣으세요. 승객명·PNR·편명을 읽습니다.'
                : 'Agoda / Trip.com 확인서·체크인 바우처 전문을 붙여넣으세요. 여기서 예약번호·호텔명·조식·편의시설을 읽습니다.'
            }
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800">
          {isAirVoucher ? 'e-ticket PDF/TXT 업로드' : '한글 + 영문 바우처 PDF/TXT (한 세트 업로드)'}
          <input
            type="file"
            multiple
            accept=".pdf,.txt,application/pdf,text/plain"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            {isAirVoucher
              ? '항공사 e-ticket PDF를 올리세요. 스캔본은 항공 OCR로 읽습니다. OTA 예약번호·Trip.com/Agoda 로고는 쓰지 않습니다.'
              : '체크인 바우처(한글)와 English check-in voucher를 함께 선택하세요. 스캔 PDF는 OCR로 읽습니다.'}
          </span>
          {files.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs font-normal text-zinc-600">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}-${f.lastModified}`}>{f.name}</li>
              ))}
            </ul>
          ) : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {!isAirVoucher ? (
            <>
              <label className="text-sm font-medium text-zinc-800">
                1박 금액 (USD · OTA 전용)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                  value={nightRateUsd}
                  readOnly
                  placeholder="PDF에서 자동"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                총 금액 (USD · OTA 전용)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                  value={amountUsd}
                  readOnly
                  placeholder="PDF에서 자동"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800 sm:col-span-2">
                OTA 숙박비 (원 · 파싱/결제당일 환율)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                  value={sourceAmountKrw}
                  readOnly
                  placeholder="생성 후 표시"
                />
                <span className="mt-1 block text-xs font-normal text-zinc-500">
                  금액은 OTA 원문만 사용합니다. 수동 수정 불가.
                  {parsedNights != null ? ` · 숙박 ${parsedNights}박` : ''}
                </span>
              </label>
              <label className="text-sm font-medium text-zinc-800 sm:col-span-2">
                결제당일 (환율 적용일)
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={rateDate}
                  onChange={(e) => setRateDate(e.target.value)}
                  readOnly={Boolean(parsed?.paymentDate)}
                />
                <span className="mt-1 block text-xs font-normal text-zinc-500">
                  {parsed?.paymentDate
                    ? `OTA 결제일 ${parsed.paymentDate} 환율로 USD→KRW 환산합니다.`
                    : 'OTA에서 결제일을 못 읽으면 여기서 지정합니다. USD 금액은 이 날짜 환율로 환산됩니다.'}
                </span>
              </label>
            </>
          ) : null}

          {documentKind === 'invoice' ? (
            <>
              <label className="text-sm font-medium text-zinc-800">
                호텔예약수수료 (원)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={hotelReservationFeeKrw}
                  onChange={(e) => setHotelReservationFeeKrw(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                항공발권수수료 (원)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={airTicketingFeeKrw}
                  onChange={(e) => setAirTicketingFeeKrw(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800 sm:col-span-2">
                여행자보험 (원)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={travelInsuranceKrw}
                  onChange={(e) => setTravelInsuranceKrw(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={visaApplied}
                  onChange={(e) => setVisaApplied(e.target.checked)}
                />
                비자 신청 포함
              </label>
              {visaApplied ? (
                <>
                  <label className="text-sm font-medium text-zinc-800">
                    비자신청비 (원)
                    <input
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={visaFeeKrw}
                      onChange={(e) => setVisaFeeKrw(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label className="text-sm font-medium text-zinc-800">
                    비자대행수수료 (원)
                    <input
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      value={visaAgencyFeeKrw}
                      onChange={(e) => setVisaAgencyFeeKrw(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          <label className="text-sm font-medium text-zinc-800 sm:col-span-2">
            {isAirVoucher ? '승객명 (체크인 바우처와 동일 칸 · 원문 그대로)' : '투숙객/고객명'}
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={
                isAirVoucher
                  ? '체크인 바우처에서 채운 이름 유지 · 비어 있으면 e-ticket 승객명'
                  : undefined
              }
            />
            {isAirVoucher ? (
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                1명이면 1명, 여러 명이면 쉼표로 모두 표시. OTA 예약번호·예약처 로고/명칭은 조건이 아닙니다.
              </span>
            ) : null}
          </label>
          {!isAirVoucher ? (
            <>
              <label className="text-sm font-medium text-zinc-800">
                숙소명 (한글)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={propertyNameKo}
                  onChange={(e) => setPropertyNameKo(e.target.value)}
                  placeholder="PDF에서 자동 채움"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                숙소명 (영문)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={propertyNameEn}
                  onChange={(e) => setPropertyNameEn(e.target.value)}
                  placeholder="PDF에서 자동 채움"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                객실 타입 (PDF 원문)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                  value={roomType}
                  readOnly
                  placeholder="한글/영문 PDF에서 그대로"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                체크인 (PDF 원문)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                  value={checkIn}
                  readOnly
                  placeholder="한글/영문 PDF에서 그대로"
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                체크아웃 (PDF 원문)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                  value={checkOut}
                  readOnly
                  placeholder="한글/영문 PDF에서 그대로"
                />
              </label>
            </>
          ) : null}
        </div>
        <label className="block text-sm font-medium text-zinc-800">
          비고 (한글 입력 시 영문 바우처 Notes로 자동 번역)
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isAirVoucher
                ? '예: 좌석 배정 요청 / 수하물 안내'
                : '예: 레이트 체크인 요청 / 조식 추가 문의'
            }
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? '생성 중…'
              : isAirVoucher
                ? '항공권 바우처 생성'
                : isVoucher
                  ? '바우처 생성'
                  : '인보이스 생성'}
          </button>
          <button
            type="button"
            disabled={busy || !html}
            onClick={() => void archiveAndDownloadPdf('both')}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            PDF 저장·보관 (한+영)
          </button>
          {isBilingualVoucher ? (
            <>
              <button
                type="button"
                disabled={busy || (!htmlKo && !html)}
                onClick={() => void archiveAndDownloadPdf('ko')}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                한글 PDF 저장·보관
              </button>
              <button
                type="button"
                disabled={busy || !htmlEn}
                onClick={() => void archiveAndDownloadPdf('en')}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                영문 PDF 저장·보관
              </button>
            </>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      {parsed && !isAirVoucher ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">PDF/본문 추출 결과</h2>
          <p className="font-semibold">
            Booking ID (OTA 예약번호): {parsed.bookingRef || '— (필수 · 없으면 생성 불가)'}
          </p>
          <p>
            OTA 예약처:{' '}
            {parsed.provider === 'agoda'
              ? 'Agoda'
              : parsed.provider === 'trip_com'
                ? 'Trip.com'
                : '미확인 (원문에 Agoda/Trip.com 표기 확인)'}
          </p>
          <p>
            숙소: {parsed.propertyNameKo || '—'} / {parsed.propertyNameEn || '—'}
          </p>
          <p>주소: {parsed.address || '—'}</p>
          <p>객실: {parsed.roomType || '—'}{parsed.bedType ? ` · ${parsed.bedType}` : ''}</p>
          <p>
            체크인/아웃: {parsed.checkIn || '—'} ~ {parsed.checkOut || '—'} ({parsed.nights ?? '—'}박)
          </p>
          <p>조식: {breakfastLabel(parsed.breakfastStatus, parsed.breakfastText)}</p>
          <p>
            세금/서비스: {parsed.taxServiceText || '원문 없음 → 바우처에 포함 고지 문구 자동 표기'}
          </p>
          <p>
            편의시설:{' '}
            {parsed.amenities.length ? parsed.amenities.join(' · ') : '—'}
          </p>
          <p>취소정책: {parsed.cancellationPolicy || '—'}</p>
          <p>특별요청: {parsed.specialRequests || '—'}</p>
          <p>결제: {parsed.paymentMethod || '—'}</p>
          {fx ? (
            <p>
              결제당일 환율: {fx.rateDate}
              {fx.effectiveDate !== fx.rateDate ? ` (고시 ${fx.effectiveDate})` : ''} · 1 USD ={' '}
              {fx.usdKrw.toLocaleString('ko-KR')} KRW ({fx.source})
              {parsed.paymentDate ? ' · OTA 결제일' : ' · 관리자 지정일'}
            </p>
          ) : null}
        </section>
      ) : null}

      {invoiceDraft ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">인보이스 요약</h2>
          <p>번호: {invoiceDraft.invoiceNumber}</p>
          <p>
            OTA 숙박비:{' '}
            {(invoiceDraft.otaStayKrw ?? invoiceDraft.sourceAmountKrw).toLocaleString('ko-KR')}원
            {invoiceDraft.sourceAmountUsd != null ? ` (USD ${invoiceDraft.sourceAmountUsd})` : ''}
          </p>
          {invoiceDraft.hotelReservationFeeKrw > 0 ? (
            <p>호텔예약수수료: {invoiceDraft.hotelReservationFeeKrw.toLocaleString('ko-KR')}원</p>
          ) : null}
          {invoiceDraft.airTicketingFeeKrw > 0 ? (
            <p>항공발권수수료: {invoiceDraft.airTicketingFeeKrw.toLocaleString('ko-KR')}원</p>
          ) : null}
          {invoiceDraft.travelInsuranceKrw > 0 ? (
            <p>여행자보험: {invoiceDraft.travelInsuranceKrw.toLocaleString('ko-KR')}원</p>
          ) : null}
          {invoiceDraft.visaApplied ? (
            <>
              <p>비자신청비: {invoiceDraft.visaFeeKrw.toLocaleString('ko-KR')}원</p>
              <p>비자대행수수료: {invoiceDraft.visaAgencyFeeKrw.toLocaleString('ko-KR')}원</p>
            </>
          ) : null}
          <p className="text-base font-semibold">
            합계: {invoiceDraft.totalKrw.toLocaleString('ko-KR')}원
          </p>
          <p className="text-xs text-zinc-600">{invoiceDraft.taxServiceIncludedNote}</p>
          {html ? (
            <iframe
              title="invoice-preview"
              className="mt-3 h-[480px] w-full rounded border border-zinc-200 bg-white"
              srcDoc={html}
            />
          ) : null}
        </section>
      ) : null}

      {voucherDraft ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">체크인 바우처 요약</h2>
          <p>번호: {voucherDraft.voucherNumber}</p>
          <p className="font-semibold">Booking ID: {voucherDraft.bookingRef || '—'}</p>
          <p>
            숙소: {voucherDraft.propertyNameKo || '—'} / {voucherDraft.propertyNameEn || '—'}
          </p>
          <p>조식: {breakfastLabel(voucherDraft.breakfastStatus, voucherDraft.breakfastTextKo)}</p>
          <p>취소정책: {voucherDraft.cancellationPolicyKo || voucherDraft.cancellationPolicyEn || '—'}</p>
          <p>결제: {voucherDraft.paymentMethod}</p>
          {voucherDraft.nightRateUsd != null ? (
            <p>
              1박: {voucherDraft.nightRateUsd} USD
              {voucherDraft.nightRateKrw != null
                ? ` (${voucherDraft.nightRateKrw.toLocaleString('ko-KR')}원)`
                : ''}
            </p>
          ) : null}
          <p>
            총액: {voucherDraft.amountUsd} USD → {voucherDraft.amountKrw.toLocaleString('ko-KR')}원
            {` · 결제당일 환율 ${voucherDraft.rateDate}`}
          </p>
          <p className="text-xs text-zinc-600">{voucherDraft.taxServiceIncludedNote}</p>
          {html ? (
            <iframe
              title="voucher-preview-bilingual"
              className="mt-3 h-[720px] w-full rounded border border-zinc-200 bg-white"
              srcDoc={html}
            />
          ) : null}
        </section>
      ) : null}

      {airVoucherDraft ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">항공권 바우처 요약</h2>
          <p>번호: {airVoucherDraft.voucherNumber}</p>
          <p className="font-semibold">PNR: {airVoucherDraft.bookingRef || airVoucherDraft.pnr || '—'}</p>
          {airVoucherDraft.ticketNumber ? (
            <p>항공권 번호: {airVoucherDraft.ticketNumber}</p>
          ) : null}
          <p>승객: {airVoucherDraft.guestName || '—'}</p>
          <p>
            여정:{' '}
            {airVoucherDraft.flights.length
              ? airVoucherDraft.flights
                  .map((f) => `${f.flightNo} ${f.depAirport || '?'}→${f.arrAirport || '?'}`)
                  .join(' · ')
              : '—'}
          </p>
          {airVoucherDraft.noticesKo || airVoucherDraft.noticesEn ? (
            <p className="whitespace-pre-wrap text-xs text-zinc-700">
              주의·참고:{' '}
              {(airVoucherDraft.noticesKo || airVoucherDraft.noticesEn || '').slice(0, 240)}
              {(airVoucherDraft.noticesKo || airVoucherDraft.noticesEn || '').length > 240
                ? '…'
                : ''}
            </p>
          ) : (
            <p className="text-xs text-zinc-500">주의사항·참고사항: e-ticket 원문에 있으면 바우처에 포함</p>
          )}
          <p className="text-xs text-zinc-600">
            OTA 예약번호·OTA 로고/명칭 없음 · 항공사 PNR·편명·주의/참고사항 표시
          </p>
          {html ? (
            <iframe
              title="air-voucher-preview-bilingual"
              className="mt-3 h-[720px] w-full rounded border border-zinc-200 bg-white"
              srcDoc={html}
            />
          ) : null}
        </section>
      ) : null}

      <section className={`${ADMIN_CARD_CLASS} space-y-3 p-5 text-sm`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-900">발행 보관 목록</h2>
          <button
            type="button"
            disabled={historyBusy}
            onClick={() => void reloadHistory()}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            {historyBusy ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
        {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}
        {!history.length && !historyBusy ? (
          <p className="text-zinc-500">아직 보관된 발행 문서가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-zinc-900">
                    {row.documentKind === 'voucher'
                      ? '체크인 바우처'
                      : row.documentKind === 'air_voucher'
                        ? '항공권 바우처'
                        : '인보이스'}{' '}
                    · {row.documentNumber}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {new Date(row.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    {row.bookingRef
                      ? row.documentKind === 'air_voucher'
                        ? ` · PNR ${row.bookingRef}`
                        : ` · Booking ${row.bookingRef}`
                      : ''}
                  </p>
                  <p className="truncate text-xs text-zinc-600">
                    {[row.guestName, row.propertyName].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {row.files.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {row.files.map((f) => (
                        <a
                          key={f.id}
                          className="text-xs text-sky-700 underline"
                          href={`/api/admin/invoices/issued/${row.id}/files/${f.id}`}
                        >
                          {f.role === 'issued_pdf'
                            ? '발행 PDF'
                            : f.role === 'issued_html'
                              ? '발행 HTML'
                              : f.fileName}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void openSaved(row.id)}
                  className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium"
                >
                  미리보기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
