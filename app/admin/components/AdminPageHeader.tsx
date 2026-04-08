type Props = {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

/**
 * 관리자 페이지 공통 헤더: H1 + 서브 문구 + 선택적 액션.
 */
export default function AdminPageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="mb-8 border-b-2 border-[#0f172a] pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f172a]">{title}</h1>
          {subtitle && <p className="bt-wrap mt-2 text-sm tracking-wide text-gray-600">{subtitle}</p>}
        </div>
        {actions != null && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
