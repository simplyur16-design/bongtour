'use client'

import type { ReactNode } from 'react'

export type TrainingWindsorTabId = 'description' | 'schedule' | 'prep'

const TABS: { id: TrainingWindsorTabId; label: string }[] = [
  { id: 'description', label: '상품설명' },
  { id: 'schedule', label: '상세일정' },
  { id: 'prep', label: '여행준비/체크사항' },
]

type Props = {
  active: TrainingWindsorTabId
  onChange: (id: TrainingWindsorTabId) => void
  children: ReactNode
}

export default function TrainingWindsorTabs({ active, onChange, children }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#DAD4EE] bg-white shadow-sm">
      <div className="flex flex-wrap border-b border-[#DAD4EE]">
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`min-w-[120px] flex-1 border-r border-[#DAD4EE] px-4 py-3.5 text-center text-sm font-bold transition-colors last:border-r-0 sm:text-base ${
                isActive
                  ? 'bg-[#534AB7] text-white shadow-inner'
                  : 'bg-[#EFEDF8] text-[#1F1B2D] hover:bg-[#E8E4F4]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="bg-white px-4 py-6 text-[#1F1B2D] sm:px-8 sm:py-8">{children}</div>
    </div>
  )
}
