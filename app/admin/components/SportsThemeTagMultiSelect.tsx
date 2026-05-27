'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  SPORTS_THEME_TAG_LABELS,
  SPORTS_THEME_TAG_VALUES,
  type SportsThemeTag,
} from '@/lib/product-listing-kind'

function formatSportsThemeSelection(labels: string[]): string {
  if (labels.length === 0) return '선택 안 함'
  return labels.join(', ')
}

type SportsThemeTagMultiSelectProps = {
  value: SportsThemeTag[]
  onChange: (next: SportsThemeTag[]) => void
  disabled?: boolean
  /** 등록(밝음) vs 상품 수정(다크) */
  tone?: 'light' | 'dark'
}

export default function SportsThemeTagMultiSelect({
  value,
  onChange,
  disabled,
  tone = 'light',
}: SportsThemeTagMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = useCallback(
    (tag: SportsThemeTag) => {
      onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag])
    },
    [onChange, value],
  )

  const selectedLabels = SPORTS_THEME_TAG_VALUES.filter((k) => value.includes(k)).map(
    (k) => SPORTS_THEME_TAG_LABELS[k],
  )

  const triggerClass =
    tone === 'dark'
      ? 'w-full max-w-xs rounded border border-bt-border-strong bg-bt-title px-2.5 py-1.5 text-left text-[11px] text-bt-inverse'
      : 'w-full max-w-xs rounded border border-slate-300 bg-white px-2.5 py-1.5 text-left text-sm text-slate-800'

  const panelClass =
    tone === 'dark'
      ? 'absolute left-0 top-full z-20 mt-1 w-full min-w-[10rem] rounded border border-bt-border-strong bg-bt-title py-1 shadow-lg'
      : 'absolute left-0 top-full z-20 mt-1 w-full min-w-[10rem] rounded border border-slate-300 bg-white py-1 shadow-lg'

  const rowClass =
    tone === 'dark'
      ? 'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] text-bt-inverse hover:bg-white/5'
      : 'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50'

  const checkboxClass =
    tone === 'dark' ? 'h-3.5 w-3.5 shrink-0 rounded border-bt-border-strong' : 'h-4 w-4 shrink-0 rounded border-slate-400'

  return (
    <div ref={rootRef} className="relative mt-2 inline-block w-full max-w-xs">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="block truncate">{formatSportsThemeSelection(selectedLabels)}</span>
      </button>
      {open && !disabled && (
        <div id={listId} role="listbox" aria-multiselectable className={panelClass}>
          {SPORTS_THEME_TAG_VALUES.map((tag) => (
            <label key={tag} className={rowClass}>
              <input
                type="checkbox"
                className={checkboxClass}
                checked={value.includes(tag)}
                onChange={() => toggle(tag)}
              />
              <span>{SPORTS_THEME_TAG_LABELS[tag]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
