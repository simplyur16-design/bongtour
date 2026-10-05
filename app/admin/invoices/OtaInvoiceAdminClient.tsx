'use client'
// REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 바우처 클라 — company-invoice만 import(로고 서버 모듈 금지) — manifest

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_CARD_CLASS } from '@/lib/admin-design-system'
import type {
  OtaAdminDocumentKind,
  OtaCompanyCheckInVoucherDraft,
  OtaCompanyInvoiceDraft,
  OtaReceiptParsedAmount,
} from '@/lib/bongtour-company-invoice'
import { breakfastLabel, computeVoucherTotalUsdFromNightRate } from '@/lib/bongtour-company-invoice'

type FxInfo = {
  rateDate: string
  effectiveDate: string
  usdKrw: number
  source: string
}

type ApiOk = {
  ok: true
  documentKind: OtaAdminDocumentKind
  parsed: OtaReceiptParsedAmount
  fx?: FxInfo
  draft: OtaCompanyInvoiceDraft | OtaCompanyCheckInVoucherDraft
  html: string
  htmlKo?: string
  htmlEn?: string
}

function todaySeoulYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
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
  const [sourceAmountKrw, setSourceAmountKrw] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [nightRateUsd, setNightRateUsd] = useState('')
  const [rateDate, setRateDate] = useState(todaySeoulYmd)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<OtaCompanyInvoiceDraft | OtaCompanyCheckInVoucherDraft | null>(
    null,
  )
  const [parsed, setParsed] = useState<OtaReceiptParsedAmount | null>(null)
  const [fx, setFx] = useState<FxInfo | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [htmlKo, setHtmlKo] = useState<string | null>(null)
  const [htmlEn, setHtmlEn] = useState<string | null>(null)

  const applyParsedToForm = useCallback((p: OtaReceiptParsedAmount) => {
    if (p.guestName) setGuestName((prev) => prev.trim() || p.guestName || '')
    if (p.propertyNameKo) setPropertyNameKo((prev) => prev.trim() || p.propertyNameKo || '')
    if (p.propertyNameEn) setPropertyNameEn((prev) => prev.trim() || p.propertyNameEn || '')
    if (!p.propertyNameKo && !p.propertyNameEn && p.propertyOrService) {
      setPropertyNameEn((prev) => prev.trim() || p.propertyOrService || '')
    }
    // 객실·체크인/아웃은 PDF 원문(한/영) 그대로 — 폼에는 표시만, 덮어쓰지 않음
    const roomShow = [p.roomTypeKo, p.roomTypeEn].filter(Boolean).join(' / ') || p.roomType
    if (roomShow) setRoomType((prev) => prev.trim() || roomShow)
    const checkInShow = [p.checkInKo, p.checkInEn].filter(Boolean).join(' / ') || p.checkIn
    if (checkInShow) setCheckIn((prev) => prev.trim() || checkInShow)
    const checkOutShow = [p.checkOutKo, p.checkOutEn].filter(Boolean).join(' / ') || p.checkOut
    if (checkOutShow) setCheckOut((prev) => prev.trim() || checkOutShow)
    if (p.nightRateUsd != null) {
      setNightRateUsd((prev) => prev.trim() || String(p.nightRateUsd))
    }
    const autoTotal = computeVoucherTotalUsdFromNightRate(
      p.nightRateUsd,
      p.nights,
    )
    if (p.totalUsd != null) {
      setAmountUsd((prev) => prev.trim() || String(p.totalUsd))
    } else if (autoTotal != null) {
      setAmountUsd((prev) => prev.trim() || String(autoTotal))
    }
  }, [])

  const parsedNights = parsed?.nights ?? null
  const nightRateNum = useMemo(() => {
    const n = Number(String(nightRateUsd).replace(/,/g, '').trim())
    return Number.isFinite(n) && n > 0 ? n : null
  }, [nightRateUsd])
  const autoTotalFromNight = useMemo(
    () => computeVoucherTotalUsdFromNightRate(nightRateNum, parsedNights),
    [nightRateNum, parsedNights],
  )

  useEffect(() => {
    if (autoTotalFromNight == null) return
    setAmountUsd(String(autoTotalFromNight))
  }, [autoTotalFromNight])

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
      // 객실·체크인/아웃은 PDF 추출값 그대로 사용 (폼 덮어쓰기 없음)
      if (note.trim()) form.set('note', note.trim())
      if (sourceAmountKrw.trim()) form.set('sourceAmountKrw', sourceAmountKrw.trim())
      if (amountUsd.trim()) form.set('amountUsd', amountUsd.trim())
      if (nightRateUsd.trim()) form.set('nightRateUsd', nightRateUsd.trim())
      for (const f of files) form.append('file', f)
      const res = await fetch('/api/admin/invoices/from-ota-receipt', { method: 'POST', body: form })
      const json = (await res.json()) as ApiOk & {
        ok: boolean
        error?: string
        parsed?: OtaReceiptParsedAmount
        fx?: FxInfo
      }
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
      setHtmlKo(json.htmlKo ?? (json.documentKind === 'voucher' ? json.html : null))
      setHtmlEn(json.htmlEn ?? null)
      if ('sourceAmountKrw' in json.draft && !sourceAmountKrw.trim() && json.draft.sourceAmountKrw) {
        setSourceAmountKrw(String(json.draft.sourceAmountKrw))
      }
      if ('nightRateUsd' in json.draft && json.draft.nightRateUsd != null) {
        setNightRateUsd(String(json.draft.nightRateUsd))
      }
      if ('amountUsd' in json.draft && json.draft.amountUsd != null) {
        setAmountUsd(String(json.draft.amountUsd))
      }
    } catch (e) {
      setDraft(null)
      setHtml(null)
      setHtmlKo(null)
      setHtmlEn(null)
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
    sourceAmountKrw,
    amountUsd,
    nightRateUsd,
    rateDate,
    applyParsedToForm,
  ])

  const printDoc = useCallback((which: 'both' | 'ko' | 'en' = 'both') => {
    const doc =
      which === 'ko' ? htmlKo || html : which === 'en' ? htmlEn || html : html
    if (!doc) return
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900')
    if (!w) return
    w.document.write(doc)
    w.document.close()
    w.focus()
    w.print()
  }, [html, htmlKo, htmlEn])

  const isVoucher = documentKind === 'voucher'
  const invoiceDraft =
    draft && 'invoiceNumber' in draft ? (draft as OtaCompanyInvoiceDraft) : null
  const voucherDraft =
    draft && 'voucherNumber' in draft ? (draft as OtaCompanyCheckInVoucherDraft) : null

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <AdminPageHeader
        title="OTA → 회사 인보이스 / 체크인 바우처"
        subtitle="OTA 한글·영문 바우처 PDF를 한 세트로 올리면 Booking ID·숙소(한/영)·조식·편의시설·취소정책을 합쳐 한글/영문 회사 바우처를 만듭니다. 회사 로고·세금/서비스요금 포함 고지가 들어갑니다."
      />

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
        </div>

        <label className="block text-sm font-medium text-zinc-800">
          OTA 바우처/영수증 본문 (예약·숙소 추출용)
          <textarea
            className="mt-1 w-full min-h-[160px] rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Agoda / Trip.com 확인서·체크인 바우처 전문을 붙여넣으세요. 여기서 예약번호·호텔명·조식·편의시설을 읽습니다."
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800">
          한글 + 영문 바우처 PDF/TXT (한 세트 업로드)
          <input
            type="file"
            multiple
            accept=".pdf,.txt,application/pdf,text/plain"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">
            체크인 바우처(한글)와 English check-in voucher를 함께 선택하세요. 스캔 PDF는 OCR로 읽습니다.
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
          <label className="text-sm font-medium text-zinc-800">
            1박 금액 (USD)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={nightRateUsd}
              onChange={(e) => setNightRateUsd(e.target.value)}
              placeholder="예: 157.20"
            />
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              {parsedNights != null
                ? `PDF 숙박 ${parsedNights}박 × 1박 = 총액 자동`
                : 'PDF에서 박수 확인 후 총액 자동 계산'}
            </span>
          </label>
          <label className="text-sm font-medium text-zinc-800">
            총 금액 (USD)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder={
                autoTotalFromNight != null
                  ? `자동 ${autoTotalFromNight}`
                  : isVoucher
                    ? '1박×박수 자동'
                    : '선택 · 입력 시 환율 환산 = 합계'
              }
              readOnly={isVoucher && autoTotalFromNight != null}
            />
          </label>
          <label className="text-sm font-medium text-zinc-800 sm:col-span-2">
            환율 적용일 (입력일)
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={rateDate}
              onChange={(e) => setRateDate(e.target.value)}
            />
          </label>

          {!isVoucher ? (
            <label className="text-sm font-medium text-zinc-800 sm:col-span-2">
              최종 금액 수동(원, USD 미입력 시)
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={sourceAmountKrw}
                onChange={(e) => setSourceAmountKrw(e.target.value)}
                placeholder="입력한 금액이 인보이스 합계입니다"
              />
            </label>
          ) : null}

          <label className="text-sm font-medium text-zinc-800">
            투숙객/고객명
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </label>
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
        </div>
        <label className="block text-sm font-medium text-zinc-800">
          비고
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '생성 중…' : isVoucher ? '바우처 생성' : '인보이스 생성'}
          </button>
          <button
            type="button"
            disabled={!html}
            onClick={() => printDoc('both')}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            인쇄 (한+영)
          </button>
          {isVoucher ? (
            <>
              <button
                type="button"
                disabled={!htmlKo && !html}
                onClick={() => printDoc('ko')}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                한글만
              </button>
              <button
                type="button"
                disabled={!htmlEn}
                onClick={() => printDoc('en')}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                영문만
              </button>
            </>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      {parsed ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">PDF/본문 추출 결과</h2>
          <p className="font-semibold">Booking ID: {parsed.bookingRef || '— (필수 · 없으면 생성 불가)'}</p>
          <p>공급원: {parsed.provider}</p>
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
              환율: {fx.rateDate}
              {fx.effectiveDate !== fx.rateDate ? ` (고시 ${fx.effectiveDate})` : ''} · 1 USD ={' '}
              {fx.usdKrw.toLocaleString('ko-KR')} KRW ({fx.source})
            </p>
          ) : null}
        </section>
      ) : null}

      {invoiceDraft ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">인보이스 요약</h2>
          <p>번호: {invoiceDraft.invoiceNumber}</p>
          {invoiceDraft.sourceAmountUsd != null ? (
            <p>
              USD {invoiceDraft.sourceAmountUsd} →{' '}
              {invoiceDraft.sourceAmountKrw.toLocaleString('ko-KR')}원
            </p>
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
    </div>
  )
}
