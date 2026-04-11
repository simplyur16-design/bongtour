'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'

export default function PrivateQuoteButton() {
  return (
    <Link
      href="/quote/private"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 sm:px-3.5 sm:text-sm"
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden />
      우리견적
    </Link>
  )
}
