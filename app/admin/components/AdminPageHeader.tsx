import {
  ADMIN_PAGE_SUBTITLE_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
} from '@/lib/admin-design-system'

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
    <header className="mb-8 border-b-2 border-bt-brand-gold-strong/40 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={ADMIN_PAGE_TITLE_CLASS}>{title}</h1>
          {subtitle && <p className={ADMIN_PAGE_SUBTITLE_CLASS}>{subtitle}</p>}
        </div>
        {actions != null && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
