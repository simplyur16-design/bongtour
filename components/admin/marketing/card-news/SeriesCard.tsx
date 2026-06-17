import Link from 'next/link'
import {
  CARD_NEWS_SERIES_STATUS_LABEL,
  seasonLabel,
} from '@/lib/bong-marketing/card-news-admin-constants'

export type SeriesCardData = {
  id: string
  weekKey: string
  themeTitle: string
  selectedCities: string[]
  tripNights: number
  tripDays: number
  season: string | null
  status: string
  episodes: { id: string }[]
}

export default function SeriesCard({ series }: { series: SeriesCardData }) {
  const citiesPreview =
    series.selectedCities.length > 0
      ? series.selectedCities.slice(0, 4).join(', ') +
        (series.selectedCities.length > 4 ? '…' : '')
      : '도시 미선정'

  return (
    <div className="rounded-xl border border-bt-border-strong bg-white p-5 shadow-sm">
      <p className="text-xs text-bt-body/60">{series.weekKey}</p>
      <h2 className="mt-1 text-lg font-semibold text-bt-title">{series.themeTitle}</h2>
      <p className="mt-2 text-sm text-bt-body/80">도시: {citiesPreview}</p>
      <p className="mt-1 text-sm text-bt-body/80">
        {series.tripNights}박 {series.tripDays}일 · {seasonLabel(series.season)}
      </p>
      <p className="mt-1 text-sm text-bt-body/70">
        편 {series.episodes.length}개 · 상태:{' '}
        {CARD_NEWS_SERIES_STATUS_LABEL[series.status] ?? series.status}
      </p>
      <Link
        href={`/admin/marketing/card-news/${series.id}`}
        className="mt-4 inline-block rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        상세 보기
      </Link>
    </div>
  )
}
