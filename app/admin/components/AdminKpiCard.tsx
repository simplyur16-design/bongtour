import Link from 'next/link'

type Tone = 'default' | 'muted' | 'amber'

type Props = {
  label: string
  value: React.ReactNode
  href?: string
  tone?: Tone
  className?: string
}

const cardClass =
  'rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#0f172a] hover:shadow'
const cardClassMuted =
  'rounded-xl border border-gray-200 bg-white p-5 shadow-sm'
const cardClassAmber =
  'rounded-xl border border-amber-200 bg-white p-5 shadow-sm'

/**
 * 관리자 KPI 카드: 라벨 + 값. href 있으면 Link로 감싸서 해당 경로로 이동.
 */
export default function AdminKpiCard({ label, value, href, tone = 'default', className = '' }: Props) {
  const baseClass =
    tone === 'amber' ? cardClassAmber : tone === 'muted' ? cardClassMuted : cardClass
  const valueClass = tone === 'amber' ? 'text-amber-700' : 'text-[#0f172a]'
  const content = (
    <>
      <p className="text-sm font-medium text-gray-500">{label}</p>
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
