'use client'

import { useCallback, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_CARD_CLASS } from '@/lib/admin-design-system'
import type {
  OtaAdminDocumentKind,
  OtaCompanyCheckInVoucherDraft,
  OtaCompanyInvoiceDraft,
  OtaReceiptParsedAmount,
} from '@/lib/bongtour-company-invoice'

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
  const [documentKind, setDocumentKind] = useState<OtaAdminDocumentKind>('invoice')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [profitMode, setProfitMode] = useState<'percent' | 'fixed'>('percent')
  const [profitPercent, setProfitPercent] = useState(15)
  const [profitFixedKrw, setProfitFixedKrw] = useState(50000)
  const [guestName, setGuestName] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [roomType, setRoomType] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [note, setNote] = useState('')
  const [sourceAmountKrw, setSourceAmountKrw] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [rateDate, setRateDate] = useState(todaySeoulYmd)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<OtaCompanyInvoiceDraft | OtaCompanyCheckInVoucherDraft | null>(
    null,
  )
  const [parsed, setParsed] = useState<OtaReceiptParsedAmount | null>(null)
  const [fx, setFx] = useState<FxInfo | null>(null)
  const [html, setHtml] = useState<string | null>(null)

  const submit = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('documentKind', documentKind)
      form.set('text', text)
      form.set('profitMode', profitMode)
      form.set('profitPercent', String(profitPercent))
      form.set('profitFixedKrw', String(profitFixedKrw))
      form.set('rateDate', rateDate || todaySeoulYmd())
      if (guestName.trim()) form.set('guestName', guestName.trim())
      if (propertyName.trim()) form.set('propertyName', propertyName.trim())
      if (roomType.trim()) form.set('roomType', roomType.trim())
      if (checkIn.trim()) form.set('checkIn', checkIn.trim())
      if (checkOut.trim()) form.set('checkOut', checkOut.trim())
      if (note.trim()) form.set('note', note.trim())
      if (sourceAmountKrw.trim()) form.set('sourceAmountKrw', sourceAmountKrw.trim())
      if (amountUsd.trim()) form.set('amountUsd', amountUsd.trim())
      if (file) form.set('file', file)
      const res = await fetch('/api/admin/invoices/from-ota-receipt', { method: 'POST', body: form })
      const json = (await res.json()) as ApiOk & {
        ok: boolean
        error?: string
        parsed?: OtaReceiptParsedAmount
        fx?: FxInfo
      }
      if (json.fx) setFx(json.fx)
      if (!json.ok) {
        if (json.parsed) setParsed(json.parsed)
        throw new Error(json.error || '문서 생성 실패')
      }
      setParsed(json.parsed)
      setDraft(json.draft)
      setHtml(json.html)
      if (json.fx) setFx(json.fx)
      if ('sourceAmountKrw' in json.draft && !sourceAmountKrw.trim() && json.draft.sourceAmountKrw) {
        setSourceAmountKrw(String(json.draft.sourceAmountKrw))
      }
      if (!guestName.trim() && json.parsed.guestName) setGuestName(json.parsed.guestName)
      if (!propertyName.trim() && json.parsed.propertyOrService) {
        setPropertyName(json.parsed.propertyOrService)
      }
      if (!roomType.trim() && json.parsed.roomType) setRoomType(json.parsed.roomType)
      if (!checkIn.trim() && json.parsed.checkIn) setCheckIn(json.parsed.checkIn)
      if (!checkOut.trim() && json.parsed.checkOut) setCheckOut(json.parsed.checkOut)
    } catch (e) {
      setDraft(null)
      setHtml(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [
    documentKind,
    text,
    file,
    profitMode,
    profitPercent,
    profitFixedKrw,
    guestName,
    propertyName,
    roomType,
    checkIn,
    checkOut,
    note,
    sourceAmountKrw,
    amountUsd,
    rateDate,
  ])

  const printDoc = useCallback(() => {
    if (!html) return
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }, [html])

  const isVoucher = documentKind === 'voucher'
  const invoiceDraft =
    draft && 'invoiceNumber' in draft ? (draft as OtaCompanyInvoiceDraft) : null
  const voucherDraft =
    draft && 'voucherNumber' in draft ? (draft as OtaCompanyCheckInVoucherDraft) : null

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <AdminPageHeader
        title="OTA → 회사 인보이스 / 체크인 바우처"
        subtitle="Trip.com·Agoda 영수증·바우처를 봉투어 양식으로 바꿉니다. 달러 금액은 입력일 환율로 원화 환산합니다."
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
          영수증/바우처 붙여넣기
          <textarea
            className="mt-1 w-full min-h-[160px] rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Agoda / Trip.com 확인서·체크인 바우처 본문을 붙여넣으세요"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800">
          또는 PDF/TXT 업로드
          <input
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-800">
            금액 (USD)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder={isVoucher ? '필수 · 예: 128.50' : '선택 · 입력 시 환율 환산'}
              required={isVoucher}
            />
          </label>
          <label className="text-sm font-medium text-zinc-800">
            환율 적용일 (입력일)
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={rateDate}
              onChange={(e) => setRateDate(e.target.value)}
            />
          </label>

          {!isVoucher ? (
            <>
              <label className="text-sm font-medium text-zinc-800">
                이익 방식
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={profitMode}
                  onChange={(e) => setProfitMode(e.target.value === 'fixed' ? 'fixed' : 'percent')}
                >
                  <option value="percent">공급가 대비 %</option>
                  <option value="fixed">고정 금액(원)</option>
                </select>
              </label>
              {profitMode === 'percent' ? (
                <label className="text-sm font-medium text-zinc-800">
                  이익 %
                  <input
                    type="number"
                    min={0}
                    max={500}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={profitPercent}
                    onChange={(e) => setProfitPercent(Number(e.target.value))}
                  />
                </label>
              ) : (
                <label className="text-sm font-medium text-zinc-800">
                  이익 고정(원)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={profitFixedKrw}
                    onChange={(e) => setProfitFixedKrw(Number(e.target.value))}
                  />
                </label>
              )}
              <label className="text-sm font-medium text-zinc-800">
                공급가 수동(원, USD 미입력 시)
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={sourceAmountKrw}
                  onChange={(e) => setSourceAmountKrw(e.target.value)}
                  placeholder="자동 파싱 실패 시"
                />
              </label>
            </>
          ) : null}

          <label className="text-sm font-medium text-zinc-800">
            투숙객/고객명
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </label>
          {isVoucher ? (
            <>
              <label className="text-sm font-medium text-zinc-800">
                숙소명
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                객실 타입
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                체크인
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-zinc-800">
                체크아웃
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </label>
            </>
          ) : null}
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
            onClick={printDoc}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            인쇄 / PDF 저장
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      {parsed ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">파싱 결과</h2>
          <p>공급원: {parsed.provider}</p>
          <p>예약번호: {parsed.bookingRef || '—'}</p>
          <p>숙소/상품: {parsed.propertyOrService || '—'}</p>
          <p>체크인/아웃: {parsed.checkIn || '—'} ~ {parsed.checkOut || '—'}</p>
          <p>감지 KRW: {parsed.sourceAmountKrw?.toLocaleString('ko-KR') ?? '—'}원</p>
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
              공급가 USD: {invoiceDraft.sourceAmountUsd} →{' '}
              {invoiceDraft.sourceAmountKrw.toLocaleString('ko-KR')}원
            </p>
          ) : (
            <p>공급가: {invoiceDraft.sourceAmountKrw.toLocaleString('ko-KR')}원</p>
          )}
          <p>회사 이익: {invoiceDraft.profitKrw.toLocaleString('ko-KR')}원</p>
          <p className="text-base font-semibold">
            합계: {invoiceDraft.totalKrw.toLocaleString('ko-KR')}원
          </p>
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
          <p>
            {voucherDraft.amountUsd} USD → {voucherDraft.amountKrw.toLocaleString('ko-KR')}원
          </p>
          <p>
            환율일 {voucherDraft.rateDate} · 1 USD = {voucherDraft.usdKrwRate.toLocaleString('ko-KR')}{' '}
            KRW
          </p>
          {html ? (
            <iframe
              title="voucher-preview"
              className="mt-3 h-[520px] w-full rounded border border-zinc-200 bg-white"
              srcDoc={html}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
