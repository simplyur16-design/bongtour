import MonthlyCurationCard from '@/components/bongtour/MonthlyCurationCard'
import type { MainCurationFetchResult } from '@/lib/fetch-curations-main'

type Props = {
  variant: 'domestic' | 'overseas'
  /** 앵커 링크용 */
  sectionId: string
  label: string
  description: string
  requestedYearMonth: string
  result: MainCurationFetchResult
}

/**
 * 국내 또는 국외 큐레이션 서브섹션.
 */
export default function MonthlyCurationSection({
  variant,
  sectionId,
  label,
  description,
  requestedYearMonth,
  result,
}: Props) {
  const { items, error, usedLooseMonth } = result
  const bar = variant === 'domestic' ? 'bg-bt-domestic' : 'bg-bt-overseas'
  const chip =
    variant === 'domestic'
      ? 'border-teal-200/80 bg-teal-50/80 text-teal-900'
      : 'border-slate-300/90 bg-slate-100/90 text-slate-800'

  return (
    <div id={sectionId} className="scroll-mt-28">
      <div className="flex gap-4">
        <div className={`mt-1 w-1 shrink-0 rounded-full ${bar}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${chip}`}>
              {label}
            </span>
            <span className="font-mono text-[11px] font-medium text-bt-muted">{requestedYearMonth}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bt-muted">{description}</p>
        </div>
      </div>

      <div className="mt-8 pl-0 sm:pl-5">
        {usedLooseMonth && !error && items.length > 0 && (
          <p className="mb-4 rounded-lg border border-bt-border bg-bt-surface px-4 py-3 text-xs leading-relaxed text-bt-muted">
            이번 달({requestedYearMonth}) 공개 카드가 없어, 같은 구분의 최근 큐레이션을 보여 드립니다.
          </p>
        )}

        {error ? (
          <div className="rounded-2xl border border-amber-200/90 bg-amber-50/60 px-4 py-8 text-center text-sm text-amber-950/90">
            <p className="font-medium">추천 정보를 잠시 불러오지 못했습니다.</p>
            <p className="mt-1 text-xs text-amber-900/80">다른 메뉴는 정상 이용하실 수 있습니다.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bt-border bg-bt-surface/80 px-4 py-12 text-center">
            <p className="text-sm font-medium text-bt-ink">
              {variant === 'overseas'
                ? '이번 달 게시된 해외 추천 카드가 아직 없습니다'
                : '곧 공개 예정입니다'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-bt-muted">
              {variant === 'overseas'
                ? '위쪽 「상담 가능 해외 일정」에서 공급사 일정을 먼저 보시거나, 나라별 탭으로 목적지를 고른 뒤 상담으로 희망 일정을 남겨 주세요. 큐레이션은 운영에서 순차적으로 채워 집니다.'
                : '문의 페이지에서 일반 상담을 신청하실 수 있습니다.'}
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <MonthlyCurationCard item={item} curationScope={variant} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
