'use client'

import { useState } from 'react'

type Props = {
  cities: string[]
  onChange: (cities: string[]) => void
  disabled?: boolean
}

export default function CitiesEditor({ cities, onChange, disabled }: Props) {
  const [draft, setDraft] = useState('')

  function addCity() {
    const v = draft.trim()
    if (!v || cities.includes(v)) return
    onChange([...cities, v])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {cities.map((city) => (
          <span
            key={city}
            className="inline-flex items-center gap-1 rounded-full bg-bt-surface-soft px-3 py-1 text-sm text-bt-title"
          >
            {city}
            {!disabled && (
              <button
                type="button"
                className="text-bt-body/60 hover:text-red-600"
                onClick={() => onChange(cities.filter((c) => c !== city))}
                aria-label={`${city} 제거`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {cities.length === 0 && (
          <span className="text-sm text-bt-body/60">도시를 추가하거나 자동 추천을 실행하세요.</span>
        )}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCity()
              }
            }}
            placeholder="도시명 입력 후 Enter"
            className="flex-1 rounded border border-bt-border-strong px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addCity}
            className="rounded-lg border border-bt-border-strong px-3 py-2 text-sm hover:bg-bt-surface-soft"
          >
            + 추가
          </button>
        </div>
      )}
    </div>
  )
}
