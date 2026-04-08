import { Suspense } from 'react'
import InquiriesPageClient from './InquiriesPageClient'

/**
 * 관리자 문의 목록 MVP. `useSearchParams` 사용 클라이언트를 Suspense로 감쌉니다.
 */
export default function AdminInquiriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 text-sm text-gray-500">
          로딩 중…
        </div>
      }
    >
      <InquiriesPageClient />
    </Suspense>
  )
}
