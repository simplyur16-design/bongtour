'use client'

import { Wallet } from 'lucide-react'

type Props = {
  open: boolean
  onClick: () => void
}

export default function BudgetFinderButton({ open, onClick }: Props) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:px-3.5 sm:text-sm"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Wallet className="h-4 w-4 shrink-0" aria-hidden />
      예산으로 찾기
    </button>
  )
}
