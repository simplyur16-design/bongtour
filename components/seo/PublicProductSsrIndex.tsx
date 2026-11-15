import Link from 'next/link'
import type { PublicProductSsrIndexItem } from '@/lib/public-product-ssr-index'

type Props = {
  /** 있으면 목록 위 h1 (클라이언트 목록이 자기 h1 을 그리기 전 HTML 용) */
  heading?: string
  intro?: string
  items: readonly PublicProductSsrIndexItem[]
  /** 섹션 라벨(aria) */
  label: string
}

/**
 * 서버 렌더 상품 목록 — JS 없이 받은 HTML 에도 상품명·링크·짧은 설명이 있게 한다(요청서 B6).
 * 클라이언트 목록이 준비되면 그 자리를 대신한다(Suspense fallback / 로딩 자리).
 * REGRESSION-FREEZE[seo-list-ssr-index]: '불러오는 중…' 만 있는 빈 HTML 금지 — manifest
 */
export default function PublicProductSsrIndex({ heading, intro, items, label }: Props) {
  return (
    <section aria-label={label} className="py-6">
      {heading ? <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{heading}</h1> : null}
      {intro ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{intro}</p> : null}
      {items.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <Link href={it.href} prefetch={false} className="font-semibold text-slate-900 hover:underline">
                {it.title}
              </Link>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{it.summary}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-slate-500">상품 목록을 준비하고 있습니다.</p>
      )}
    </section>
  )
}
