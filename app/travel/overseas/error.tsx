'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function OverseasTravelError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[travel/overseas]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-lg font-bold text-slate-900">해외여행 상품을 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-slate-600">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 상담으로 문의해 주시면 안내해 드리겠습니다.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          메인으로
        </Link>
      </div>
    </div>
  )
}
