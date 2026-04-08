import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-slate-600">주소가 바뀌었거나 삭제된 페이지일 수 있습니다.</p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950"
      >
        홈으로 돌아가기
      </Link>
    </div>
  )
}
