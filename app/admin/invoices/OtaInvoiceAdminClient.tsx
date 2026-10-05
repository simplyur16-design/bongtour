'use client'

import { useCallback, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_CARD_CLASS } from '@/lib/admin-design-system'
import type { OtaCompanyInvoiceDraft, OtaReceiptParsedAmount } from '@/lib/bongtour-company-invoice'

type ApiOk = {
  ok: true
  parsed: OtaReceiptParsedAmount
  draft: OtaCompanyInvoiceDraft
  html: string
}

export default function OtaInvoiceAdminClient() {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [profitMode, setProfitMode] = useState<'percent' | 'fixed'>('percent')
  const [profitPercent, setProfitPercent] = useState(15)
  const [profitFixedKrw, setProfitFixedKrw] = useState(50000)
  const [guestName, setGuestName] = useState('')
  const [note, setNote] = useState('')
  const [sourceAmountKrw, setSourceAmountKrw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<OtaCompanyInvoiceDraft | null>(null)
  const [parsed, setParsed] = useState<OtaReceiptParsedAmount | null>(null)
  const [html, setHtml] = useState<string | null>(null)

  const submit = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('text', text)
      form.set('profitMode', profitMode)
      form.set('profitPercent', String(profitPercent))
      form.set('profitFixedKrw', String(profitFixedKrw))
      if (guestName.trim()) form.set('guestName', guestName.trim())
      if (note.trim()) form.set('note', note.trim())
      if (sourceAmountKrw.trim()) form.set('sourceAmountKrw', sourceAmountKrw.trim())
      if (file) form.set('file', file)
      const res = await fetch('/api/admin/invoices/from-ota-receipt', { method: 'POST', body: form })
      const json = (await res.json()) as ApiOk & { ok: boolean; error?: string; parsed?: OtaReceiptParsedAmount }
      if (!json.ok) {
        if (json.parsed) setParsed(json.parsed)
        throw new Error(json.error || '인보이스 생성 실패')
      }
      setParsed(json.parsed)
      setDraft(json.draft)
      setHtml(json.html)
      if (!sourceAmountKrw.trim() && json.draft.sourceAmountKrw) {
        setSourceAmountKrw(String(json.draft.sourceAmountKrw))
      }
    } catch (e) {
      setDraft(null)
      setHtml(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [text, file, profitMode, profitPercent, profitFixedKrw, guestName, note, sourceAmountKrw])

  const printInvoice = useCallback(() => {
    if (!html) return
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }, [html])

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <AdminPageHeader
        title="OTA 영수증 → 회사 인보이스"
        description="Trip.com·Agoda 영수증(텍스트/PDF)을 올려 공급가에 회사 이익을 더한 봉투어 인보이스를 만듭니다."
      />

      <section className={`${ADMIN_CARD_CLASS} space-y-4 p-5`}>
        <label className="block text-sm font-medium text-zinc-800">
          영수증 붙여넣기
          <textarea
            className="mt-1 w-full min-h-[160px] rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Agoda / Trip.com 확인서·영수증 본문을 붙여넣으세요"
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
            공급가 수동 입력(원, 선택)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={sourceAmountKrw}
              onChange={(e) => setSourceAmountKrw(e.target.value)}
              placeholder="자동 파싱 실패 시 입력"
            />
          </label>
          <label className="text-sm font-medium text-zinc-800">
            청구 고객명(선택)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
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
            {busy ? '생성 중…' : '인보이스 생성'}
          </button>
          <button
            type="button"
            disabled={!html}
            onClick={printInvoice}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            인쇄 / PDF 저장
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      {parsed ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">영수증 파싱</h2>
          <p>공급원: {parsed.provider}</p>
          <p>예약번호: {parsed.bookingRef || '—'}</p>
          <p>숙소/상품: {parsed.propertyOrService || '—'}</p>
          <p>감지 금액: {parsed.sourceAmountKrw?.toLocaleString('ko-KR') ?? '—'}원</p>
        </section>
      ) : null}

      {draft ? (
        <section className={`${ADMIN_CARD_CLASS} space-y-2 p-5 text-sm`}>
          <h2 className="font-semibold text-zinc-900">인보이스 요약</h2>
          <p>번호: {draft.invoiceNumber}</p>
          <p>공급가: {draft.sourceAmountKrw.toLocaleString('ko-KR')}원</p>
          <p>회사 이익: {draft.profitKrw.toLocaleString('ko-KR')}원</p>
          <p className="text-base font-semibold">합계: {draft.totalKrw.toLocaleString('ko-KR')}원</p>
          {html ? (
            <iframe title="invoice-preview" className="mt-3 h-[480px] w-full rounded border border-zinc-200 bg-white" srcDoc={html} />
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
