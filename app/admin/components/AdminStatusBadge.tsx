export type AdminStatusVariant =
  | 'pending'
  | 'pending_image'
  | 'pending_review'
  | 'registered'
  | 'on_hold'
  | 'rejected'
  | 'hidden'
  | 'error'
  | 'received'
  | 'consulting'
  | 'booking_processing'
  | 'confirmed'
  | 'cancelled'
  | 'visible'
  | 'invisible'

const VARIANT_CONFIG: Record<
  AdminStatusVariant,
  { label: string; className: string }
> = {
  pending: { label: '등록대기', className: 'border-bt-border-soft bg-bt-badge-freeform text-bt-badge-freeform-text' },
  pending_image: { label: '이미지 수급', className: 'border-bt-border-soft bg-bt-badge-freeform text-bt-badge-freeform-text' },
  pending_review: { label: '검수대기', className: 'border-bt-border-soft bg-bt-badge-freeform text-bt-badge-freeform-text' },
  registered: { label: '등록완료', className: 'border-bt-border-soft bg-bt-badge-domestic text-bt-badge-domestic-text' },
  on_hold: { label: '보류', className: 'border-bt-border-soft bg-bt-surface-alt text-bt-muted' },
  rejected: { label: '반려', className: 'border-bt-border-strong bg-bt-surface-soft text-bt-danger' },
  hidden: { label: '비노출', className: 'border-bt-border-soft bg-bt-surface-alt text-bt-muted' },
  error: { label: '오류', className: 'border-bt-border-strong bg-bt-surface-soft text-bt-danger' },
  received: { label: '접수완료', className: 'border-bt-border-soft bg-bt-surface-alt text-bt-body' },
  consulting: { label: '상담중', className: 'border-bt-border-soft bg-bt-badge-package text-bt-badge-package-text' },
  booking_processing: { label: '예약진행중', className: 'border-bt-border-soft bg-bt-brand-blue-soft text-bt-brand-blue-strong' },
  confirmed: { label: '예약확정', className: 'border-bt-border-soft bg-bt-badge-domestic text-bt-badge-domestic-text' },
  cancelled: { label: '취소', className: 'border-bt-border-soft bg-bt-surface-alt text-bt-meta' },
  visible: { label: '노출', className: 'border-bt-border-soft bg-bt-badge-domestic text-bt-badge-domestic-text' },
  invisible: { label: '비노출', className: 'border-bt-border-soft bg-bt-surface-alt text-bt-muted' },
}

type Props = {
  variant: AdminStatusVariant
  label?: string
  className?: string
}

/**
 * 관리자 상태 배지. 상품/상담 상태 등 일관된 라벨·색 톤.
 */
export default function AdminStatusBadge({ variant, label: customLabel, className = '' }: Props) {
  const config = VARIANT_CONFIG[variant]
  const label = customLabel ?? config.label
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${config.className} ${className}`}
    >
      {label}
    </span>
  )
}
