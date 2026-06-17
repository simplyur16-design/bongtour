'use client'

import { useEffect, useState } from 'react'

export type HookFormValues = {
  hookText: string
  hookType: 'good' | 'bad'
  category: string
  tags: string
  context: string
  isActive: boolean
}

type Props = {
  open: boolean
  title: string
  initial?: Partial<HookFormValues>
  submitLabel: string
  onClose: () => void
  onSubmit: (values: HookFormValues) => Promise<void>
}

export default function HookForm({ open, title, initial, submitLabel, onClose, onSubmit }: Props) {
  const [hookText, setHookText] = useState('')
  const [hookType, setHookType] = useState<'good' | 'bad'>('good')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [context, setContext] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setHookText(initial?.hookText ?? '')
    setHookType(initial?.hookType ?? 'good')
    setCategory(initial?.category ?? '')
    setTags(initial?.tags ?? '')
    setContext(initial?.context ?? '')
    setIsActive(initial?.isActive ?? true)
    setError('')
  }, [open, initial])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-bt-title">{title}</h2>
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            void onSubmit({
              hookText: hookText.trim(),
              hookType,
              category: category.trim(),
              tags: tags.trim(),
              context: context.trim(),
              isActive,
            })
              .then(() => onClose())
              .catch((err) => setError(err instanceof Error ? err.message : '저장 실패'))
              .finally(() => setBusy(false))
          }}
        >
          <label className="block text-sm">
            <span className="text-bt-body/80">후킹 카피</span>
            <textarea
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              rows={2}
              required
              maxLength={50}
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={hookType === 'good'}
                onChange={() => setHookType('good')}
              />
              모범 (good)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={hookType === 'bad'}
                onChange={() => setHookType('bad')}
              />
              금지 (bad)
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-bt-body/80">카테고리</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="package, tip, season …"
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-bt-body/80">태그 (쉼표 구분)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-bt-body/80">컨텍스트 (선택)</span>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            활성 (카드뉴스 생성 시 참조)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '저장 중…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
