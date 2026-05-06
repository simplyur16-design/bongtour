'use client'

import { useMemo, useState } from 'react'

export type MasterTreeCity = {
  cityKey: string
  koreanLabel: string
  sortOrder: number
  countryKey: string
}

export type MasterTreeCountry = {
  countryKey: string
  koreanLabel: string
  sortOrder: number
  continentKey: string
  cities: MasterTreeCity[]
}

export type MasterTreeContinent = {
  continentKey: string
  koreanLabel: string
  sortOrder: number
  countries: MasterTreeCountry[]
}

export type MasterPrimaryValue = {
  continentKey: string
  countryKey: string
  cityKey: string | null
}

function normQ(s: string) {
  return s.trim().toLowerCase()
}

/** 대표: 권역 → 국가 → 도시(없음 가능) 드릴다운 + 검색 */
export function MasterPrimaryGeoPicker({
  continents,
  value,
  onChange,
}: {
  continents: MasterTreeContinent[]
  value: MasterPrimaryValue
  onChange: (v: MasterPrimaryValue) => void
}) {
  const [q, setQ] = useState('')

  const continent = useMemo(
    () => continents.find((c) => c.continentKey === value.continentKey) ?? null,
    [continents, value.continentKey],
  )
  const country = useMemo(
    () => continent?.countries.find((c) => c.countryKey === value.countryKey) ?? null,
    [continent, value.countryKey],
  )

  const qn = normQ(q)

  const filteredContinents = useMemo(() => {
    if (!qn) return continents
    return continents.filter(
      (c) =>
        c.koreanLabel.toLowerCase().includes(qn) ||
        c.continentKey.toLowerCase().includes(qn) ||
        c.countries.some(
          (co) =>
            co.koreanLabel.toLowerCase().includes(qn) ||
            co.countryKey.toLowerCase().includes(qn) ||
            co.cities.some(
              (ci) =>
                ci.koreanLabel.toLowerCase().includes(qn) || ci.cityKey.toLowerCase().includes(qn),
            ),
        ),
    )
  }, [continents, qn])

  const filteredCountries = useMemo(() => {
    const list = continent?.countries ?? []
    if (!qn) return list
    return list.filter(
      (co) =>
        co.koreanLabel.toLowerCase().includes(qn) ||
        co.countryKey.toLowerCase().includes(qn) ||
        co.cities.some(
          (ci) => ci.koreanLabel.toLowerCase().includes(qn) || ci.cityKey.toLowerCase().includes(qn),
        ),
    )
  }, [continent, qn])

  const filteredCities = useMemo(() => {
    const list = country?.cities ?? []
    if (!qn) return list
    return list.filter(
      (ci) => ci.koreanLabel.toLowerCase().includes(qn) || ci.cityKey.toLowerCase().includes(qn),
    )
  }, [country, qn])

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="권역·국가·도시 검색…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded border border-bt-border px-3 py-2 text-sm"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-bt-muted">1. 권역</label>
          <select
            className="max-h-40 w-full rounded border border-bt-border px-2 py-2 text-sm md:max-h-56"
            size={6}
            value={value.continentKey}
            onChange={(e) => {
              const ck = e.target.value
              onChange({ continentKey: ck, countryKey: '', cityKey: null })
            }}
          >
            <option value="">— 선택 —</option>
            {filteredContinents.map((c) => (
              <option key={c.continentKey} value={c.continentKey}>
                {c.koreanLabel} ({c.continentKey})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-bt-muted">2. 국가</label>
          <select
            className="max-h-40 w-full rounded border border-bt-border px-2 py-2 text-sm md:max-h-56"
            size={6}
            disabled={!value.continentKey}
            value={value.countryKey}
            onChange={(e) => {
              const ck = e.target.value
              onChange({ ...value, countryKey: ck, cityKey: null })
            }}
          >
            <option value="">— 선택 —</option>
            {filteredCountries.map((co) => (
              <option key={co.countryKey} value={co.countryKey}>
                {co.koreanLabel} ({co.countryKey})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-bt-muted">3. 도시 (선택)</label>
          <select
            className="max-h-40 w-full rounded border border-bt-border px-2 py-2 text-sm md:max-h-56"
            size={6}
            disabled={!value.countryKey}
            value={value.cityKey ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onChange({ ...value, cityKey: v === '' ? null : v })
            }}
          >
            <option value="">— 국가만 (도시 없음) —</option>
            {filteredCities.map((ci) => (
              <option key={ci.cityKey} value={ci.cityKey}>
                {ci.koreanLabel} ({ci.cityKey})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

type CountryOption = { countryKey: string; path: string }
type CityOption = { cityKey: string; path: string }

function flattenCountriesForMulti(continents: MasterTreeContinent[]): CountryOption[] {
  const out: CountryOption[] = []
  for (const c of continents) {
    for (const co of c.countries) {
      out.push({
        countryKey: co.countryKey,
        path: `${c.koreanLabel} › ${co.koreanLabel}`,
      })
    }
  }
  return out
}

function flattenCitiesForMulti(continents: MasterTreeContinent[]): CityOption[] {
  const out: CityOption[] = []
  for (const c of continents) {
    for (const co of c.countries) {
      for (const ci of co.cities) {
        out.push({
          cityKey: ci.cityKey,
          path: `${c.koreanLabel} › ${co.koreanLabel} › ${ci.koreanLabel}`,
        })
      }
    }
  }
  return out
}

/** 보조 국가: 마스터 멀티 (대표 국가 제외) */
export function MasterCountryMultiPicker({
  continents,
  primaryCountryKey,
  value,
  onChange,
}: {
  continents: MasterTreeContinent[]
  primaryCountryKey: string
  value: string[]
  onChange: (keys: string[]) => void
}) {
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const flat = useMemo(() => flattenCountriesForMulti(continents), [continents])
  const qn = normQ(q)

  const filtered = useMemo(() => {
    let rows = flat.filter((r) => r.countryKey !== primaryCountryKey && !value.includes(r.countryKey))
    if (qn) {
      rows = rows.filter(
        (r) => r.path.toLowerCase().includes(qn) || r.countryKey.toLowerCase().includes(qn),
      )
    }
    return rows
  }, [flat, primaryCountryKey, value, qn])

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of flat) m.set(r.countryKey, r.path)
    return m
  }, [flat])

  function add() {
    if (!draft) return
    if (draft === primaryCountryKey || value.includes(draft)) return
    onChange([...value, draft])
    setDraft('')
  }

  function remove(k: string) {
    onChange(value.filter((x) => x !== k))
  }

  return (
    <div className="rounded-lg border border-dashed border-bt-border bg-bt-surface-soft/50 p-4">
      <h3 className="text-sm font-semibold text-bt-title">보조 국가 (마스터)</h3>
      <p className="mt-1 text-xs text-bt-muted">
        실제 방문국만 추가하세요. 경유·환승만인 국가는 넣지 않습니다. 대표 국가와 동일한 키는 제외됩니다.
      </p>
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((k, idx) => (
            <li
              key={k}
              className="flex items-start justify-between gap-2 rounded border border-bt-border bg-white px-3 py-2 text-xs"
            >
              <span>
                <span className="text-bt-muted">{idx + 1}. </span>
                {labelByKey.get(k) ?? k}
                <span className="ml-1 font-mono text-[10px] text-bt-muted">({k})</span>
              </span>
              <button type="button" className="shrink-0 text-red-600 hover:underline" onClick={() => remove(k)}>
                × 삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="search"
        placeholder="국가 검색…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mt-3 w-full rounded border border-bt-border px-3 py-2 text-sm"
      />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <select
            className="w-full rounded border border-bt-border px-2 py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          >
            <option value="">— 국가 선택 후 추가 —</option>
            {filtered.map((r) => (
              <option key={r.countryKey} value={r.countryKey}>
                {r.path}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!draft || !primaryCountryKey}
          onClick={add}
          className="rounded-lg border border-bt-border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          + 추가
        </button>
      </div>
    </div>
  )
}

/** 보조 도시: 마스터 멀티 (대표 도시 제외) */
export function MasterCityMultiPicker({
  continents,
  primaryCityKey,
  value,
  onChange,
}: {
  continents: MasterTreeContinent[]
  primaryCityKey: string | null
  value: string[]
  onChange: (keys: string[]) => void
}) {
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const flat = useMemo(() => flattenCitiesForMulti(continents), [continents])
  const qn = normQ(q)

  const filtered = useMemo(() => {
    const pk = primaryCityKey ?? ''
    let rows = flat.filter((r) => r.cityKey !== pk && !value.includes(r.cityKey))
    if (qn) {
      rows = rows.filter(
        (r) => r.path.toLowerCase().includes(qn) || r.cityKey.toLowerCase().includes(qn),
      )
    }
    return rows
  }, [flat, primaryCityKey, value, qn])

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of flat) m.set(r.cityKey, r.path)
    return m
  }, [flat])

  function add() {
    if (!draft) return
    if (draft === (primaryCityKey ?? '') || value.includes(draft)) return
    onChange([...value, draft])
    setDraft('')
  }

  function remove(k: string) {
    onChange(value.filter((x) => x !== k))
  }

  return (
    <div className="rounded-lg border border-dashed border-bt-border bg-bt-surface-soft/50 p-4">
      <h3 className="text-sm font-semibold text-bt-title">보조 도시 (마스터)</h3>
      <p className="mt-1 text-xs text-bt-muted">
        다도시 패키지일 때만 사용합니다. 대표에 도시가 없으면 보조 도시를 넣을 수 없습니다.
      </p>
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((k, idx) => (
            <li
              key={k}
              className="flex items-start justify-between gap-2 rounded border border-bt-border bg-white px-3 py-2 text-xs"
            >
              <span>
                <span className="text-bt-muted">{idx + 1}. </span>
                {labelByKey.get(k) ?? k}
                <span className="ml-1 font-mono text-[10px] text-bt-muted">({k})</span>
              </span>
              <button type="button" className="shrink-0 text-red-600 hover:underline" onClick={() => remove(k)}>
                × 삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="search"
        placeholder="도시 검색…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mt-3 w-full rounded border border-bt-border px-3 py-2 text-sm"
      />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <select
            className="w-full rounded border border-bt-border px-2 py-2 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!primaryCityKey}
          >
            <option value="">{primaryCityKey ? '— 도시 선택 후 추가 —' : '— 먼저 대표 도시를 선택 —'}</option>
            {filtered.map((r) => (
              <option key={r.cityKey} value={r.cityKey}>
                {r.path}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!draft || !primaryCityKey}
          onClick={add}
          className="rounded-lg border border-bt-border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          + 추가
        </button>
      </div>
    </div>
  )
}

/** 목록 행에서 마스터 primary 초기값 도출 (continentKey 비어 있을 때 국가로 역추적) */
export function resolveMasterPrimaryFromRow(
  continents: MasterTreeContinent[],
  row: {
    continentKey: string | null
    countryKey: string | null
    cityKey: string | null
  },
): MasterPrimaryValue | null {
  const ckCountry = (row.countryKey ?? '').trim()
  if (!ckCountry) return null

  if (row.continentKey) {
    const cont = continents.find((c) => c.continentKey === row.continentKey)
    const co = cont?.countries.find((c) => c.countryKey === ckCountry)
    if (co) {
      return {
        continentKey: row.continentKey,
        countryKey: ckCountry,
        cityKey: row.cityKey?.trim() || null,
      }
    }
  }

  for (const c of continents) {
    const co = c.countries.find((x) => x.countryKey === ckCountry)
    if (co) {
      const cityKey = row.cityKey?.trim() || null
      if (cityKey) {
        const hasCity = co.cities.some((ci) => ci.cityKey === cityKey)
        if (!hasCity) {
          return { continentKey: c.continentKey, countryKey: ckCountry, cityKey: null }
        }
      }
      return { continentKey: c.continentKey, countryKey: ckCountry, cityKey }
    }
  }

  return null
}
