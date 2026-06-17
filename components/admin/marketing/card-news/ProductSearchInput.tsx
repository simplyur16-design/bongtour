'use client'

import { useEffect, useState } from 'react'

export type ProductSearchItem = {
  id: string
  title: string
  country: string | null
  city: string | null
  primaryDestination: string | null
}

type Props = {
  value: ProductSearchItem | null
  onChange: (product: ProductSearchItem | null) => void
  disabled?: boolean
}

export default function ProductSearchInput({ value, onChange, disabled }: Props) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<ProductSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!q.trim() || disabled) {
      setItems([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q.trim())}&limit=10`)
        const data = await res.json()
        setItems(Array.isArray(data.items) ? data.items : [])
        setOpen(true)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, disabled])

  if (value) {
    return (
      <div className="rounded-lg border border-bt-border-strong bg-bt-surface-soft p-3 text-sm">
        <p className="font-medium text-bt-title">{value.title}</p>
        <p className="mt-1 text-bt-body/70">
          {[value.city, value.country, value.primaryDestination].filter(Boolean).join(' · ') || '지역 정보 없음'}
        </p>
        {!disabled && (
          <button
            type="button"
            className="mt-2 text-sm text-bt-brand-blue hover:underline"
            onClick={() => onChange(null)}
          >
            연결 해제
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        placeholder="상품명·도시·국가 검색"
        className="w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
      />
      {loading && <p className="mt-1 text-xs text-bt-body/60">검색 중…</p>}
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-bt-border-strong bg-white shadow-lg">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-bt-surface-soft"
                onClick={() => {
                  onChange(item)
                  setQ('')
                  setOpen(false)
                }}
              >
                <span className="font-medium text-bt-title">{item.title}</span>
                <span className="ml-2 text-bt-body/60">
                  {[item.city, item.country].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
