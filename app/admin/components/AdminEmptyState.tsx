import Link from 'next/link'
import {
  ADMIN_BTN_PRIMARY_CLASS,
  ADMIN_CARD_CLASS,
} from '@/lib/admin-design-system'

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
    <div className={`${ADMIN_CARD_CLASS} py-12 text-center ${className}`}>
      <p className="text-sm font-medium text-bt-text-navy">{title}</p>
      {description && <p className="mt-1 text-sm text-bt-text-muted-lavender">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`mt-4 ${ADMIN_BTN_PRIMARY_CLASS}`}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
