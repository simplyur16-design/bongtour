'use client'

import type { ReactNode } from 'react'
import {
  TRAINING_PUBLIC_ACCENT,
  TRAINING_PUBLIC_BG,
  TRAINING_PUBLIC_BG_HOVER,
  TRAINING_PUBLIC_BORDER,
  TRAINING_PUBLIC_TEXT,
  TRAINING_WINDSOR_TABS_ROOT,
} from '@/components/training/training-public-theme'

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
    <div
      className={`${TRAINING_WINDSOR_TABS_ROOT} overflow-hidden rounded-2xl border ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG} shadow-sm`}
    >
      <div className={`flex flex-wrap border-b ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG}`}>
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`min-w-[120px] flex-1 border-r ${TRAINING_PUBLIC_BORDER} px-4 py-3.5 text-center text-sm font-bold transition-colors last:border-r-0 sm:text-base ${
                isActive
                  ? `-mb-px border-b-2 ${TRAINING_PUBLIC_ACCENT} ${TRAINING_PUBLIC_BG_HOVER}`
                  : `${TRAINING_PUBLIC_BG} hover:bg-[#E8E4F4]`
              }`}
            >
              <span className={`bt-training-windsor-tab-label ${TRAINING_PUBLIC_TEXT}`}>{t.label}</span>
            </button>
          )
        })}
      </div>
      <div className={`${TRAINING_PUBLIC_BG} px-4 py-6 sm:px-8 sm:py-8 ${TRAINING_PUBLIC_TEXT}`}>{children}</div>
    </div>
  )
}
