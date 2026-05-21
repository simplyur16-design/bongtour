'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  buildOverseasMegaMenuLocationSuggestions,
  filterOverseasLocationSuggestions,
  type OverseasLocationSuggestion,
} from '@/lib/overseas-mega-menu-location-suggestions'

type Props = {
  valueLabel: string
  onSelect: (item: OverseasLocationSuggestion) => void
  onClear?: () => void
  placeholder?: string
  label?: string
  showMenuHint?: boolean
  className?: string
  inputClassName?: string
}

export default function OverseasDestinationAutocomplete({
  valueLabel,
  onSelect,
  onClear,
  placeholder = '나라·도시 검색 (예: 다낭, 도쿄, 태국)',
  label = '가고 싶은 곳',
  showMenuHint = true,
  className = '',
  inputClassName = '',
}: Props) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)
  const [query, setQuery] = useState(valueLabel)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const allSuggestions = useMemo(() => buildOverseasMegaMenuLocationSuggestions(), [])
  const filtered = useMemo(
    () => filterOverseasLocationSuggestions(allSuggestions, query, 10),
    [allSuggestions, query],
  )

  useEffect(() => {
    if (!isEditingRef.current) {
      setQuery(valueLabel)
    }
  }, [valueLabel])

  useEffect(() => {
    setActiveIdx(0)
  }, [query, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (item: OverseasLocationSuggestion) => {
    isEditingRef.current = false
    setQuery(`${item.label} · ${item.sublabel}`)
    setOpen(false)
    onSelect(item)
  }

  const beginEditing = () => {
    isEditingRef.current = true
    if (valueLabel.trim() && query === valueLabel) {
      setQuery('')
    }
    setOpen(true)
  }

  const endEditing = () => {
    isEditingRef.current = false
    setOpen(false)
    setQuery(valueLabel)
  }

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      <label htmlFor={listId} className="text-sm font-medium text-bt-ink">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={listId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            isEditingRef.current = true
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={beginEditing}
          onClick={() => {
            isEditingRef.current = true
            setOpen(true)
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (wrapRef.current?.contains(document.activeElement)) return
              endEditing()
            }, 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (!open || filtered.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIdx((i) => (i + 1) % filtered.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const item = filtered[activeIdx]
              if (item) pick(item)
            }
          }}
          className={
            inputClassName ||
            'w-full rounded-lg border border-bt-border bg-white px-3 py-2.5 pr-9 text-sm text-bt-ink outline-none placeholder:text-bt-subtle focus:border-bt-ui-accent focus:ring-2 focus:ring-bt-ui-accent/25'
          }
        />
        {(query.trim() || valueLabel.trim()) && onClear ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              isEditingRef.current = false
              setQuery('')
              onClear()
              setOpen(false)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-bt-muted hover:text-bt-ink"
            aria-label="목적지 지우기"
          >
            ✕
          </button>
        ) : null}
      </div>
      {open && filtered.length > 0 ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-bt-border bg-white py-1 shadow-lg"
        >
          {filtered.map((item, idx) => (
            <li key={item.id} role="option" aria-selected={idx === activeIdx}>
              <button
                type="button"
                className={`flex w-full flex-col items-start px-3 py-2.5 text-left text-sm ${
                  idx === activeIdx ? 'bg-bt-accent-subtle text-bt-ink' : 'text-bt-ink hover:bg-slate-50'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
              >
                <span className="font-semibold">{item.label}</span>
                <span className="text-xs text-bt-muted">
                  {item.kind === 'country' ? `${item.sublabel} · 전체 상품` : item.sublabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {showMenuHint ? (
        <p className="mt-1 text-[11px] text-bt-subtle">메가메뉴와 동일한 나라·도시 목록입니다.</p>
      ) : null}
    </div>
  )
}
