import Link from 'next/link'
import { ADMIN_CARD_CLASS, ADMIN_CARD_HOVER_CLASS } from '@/lib/admin-design-system'

type Tone = 'default' | 'muted' | 'amber'

type Props = {
  label: string
  value: React.ReactNode
  href?: string
  tone?: Tone
  className?: string
}

const cardClass = `${ADMIN_CARD_CLASS} ${ADMIN_CARD_HOVER_CLASS}`
const cardClassMuted = ADMIN_CARD_CLASS
const cardClassAmber = `${ADMIN_CARD_CLASS} border-amber-200/80`

/**
 * 관리자 KPI 카드: 라벨 + 값. href 있으면 Link로 감싸서 해당 경로로 이동.
 */
export default function AdminKpiCard({ label, value, href, tone = 'default', className = '' }: Props) {
  const baseClass =
    tone === 'amber' ? cardClassAmber : tone === 'muted' ? cardClassMuted : cardClass
  const valueClass = tone === 'amber' ? 'text-amber-700' : 'text-bt-text-navy'
  const content = (
    <>
      <p className="text-sm font-medium text-bt-text-muted-lavender">{label}</p>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
    </>
  )
  if (href) {
    return (
      <Link href={href} className={`block ${baseClass} ${className}`}>
        {content}
      </Link>
    )
  }
  return <div className={`${baseClass} ${className}`}>{content}</div>
}
