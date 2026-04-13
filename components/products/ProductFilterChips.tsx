'use client'

import type { BrowseQueryState } from '@/lib/products-browse-query'
import { catalogEntryByCode } from '@/lib/airline-catalog'

const HOUR_LABEL: Record<string, string> = {
  '04-07': '04~07시',
  '07-11': '07~11시',
  '11-14': '11~14시',
  '14-16': '14~16시',
  '16-20': '16~20시',
  '20-24': '20~24시',
}

const WD = ['일', '월', '화', '수', '목', '금', '토']

const CAT_LABEL: Record<string, string> = {
  airtel: '항공권+호텔(자유여행)',
  private: '단독패키지',
  premium: '프리미엄',
}

type Chip = { key: string; label: string }

export function buildFilterChips(q: BrowseQueryState): Chip[] {
  const out: Chip[] = []
  if (q.noOptionalTour) out.push({ key: 'noOptionalTour', label: '현지옵션 없음' })
  if (q.noShopping) out.push({ key: 'noShopping', label: '쇼핑 없음' })
  for (const b of q.brands) out.push({ key: `brand:${b}`, label: `여행사:${b}` })
  for (const c of q.categories) out.push({ key: `cat:${c}`, label: CAT_LABEL[c] ?? c })
  for (const a of q.airlines) {
    const lab = a === 'other' ? '항공:기타' : `항공:${catalogEntryByCode(a)?.label ?? a}`
    out.push({ key: `air:${a}`, label: lab })
  }
  for (const h of q.departHours) {
    out.push({ key: `hour:${h}`, label: `시간:${HOUR_LABEL[h] ?? h}` })
  }
  for (const d of q.departWeekdays) {
    out.push({ key: `day:${d}`, label: `출발:${WD[d] ?? d}요일` })
  }
  if (q.budgetMin != null || q.budgetPerPerson != null) {
    const parts: string[] = []
    if (q.budgetMin != null) parts.push(`${(q.budgetMin / 10000).toFixed(0)}만↑`)
    if (q.budgetPerPerson != null) parts.push(`${(q.budgetPerPerson / 10000).toFixed(0)}만↓`)
    out.push({ key: 'budget', label: `예산:${parts.join('~')}` })
  }
  return out
}

type Props = {
  chips: Chip[]
  onRemove: (key: string) => void
  onClearAll: () => void
}

export default function ProductFilterChips({ chips, onRemove, onClearAll }: Props) {
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100"
        >
          {c.label}
          <span className="text-teal-600" aria-hidden>
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        필터 초기화
      </button>
    </div>
  )
}
