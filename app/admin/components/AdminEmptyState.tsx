import Link from 'next/link'

type Props = {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  className?: string
}

/**
 * 관리자 빈 상태: 메시지 + 선택적 다음 행동 링크.
 */
export default function AdminEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  className = '',
}: Props) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white py-12 text-center ${className}`}
    >
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1e293b]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
