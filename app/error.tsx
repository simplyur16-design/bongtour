'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">문제가 발생했습니다</h1>
      <p className="mt-2 text-sm text-slate-600">잠시 후 다시 시도해 주세요.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => reset()}
          className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950"
        >
          다시 시도
        </button>
        <Link href="/" className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950">
          홈으로
        </Link>
      </div>
    </div>
  )
}
