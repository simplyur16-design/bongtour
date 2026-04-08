'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import type { GalleryProduct } from '@/app/api/gallery/route'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`
}

function formatPrice(krw: number | null): string {
  if (krw == null || krw <= 0) return '—'
  if (krw >= 10000) return `${Math.floor(krw / 10000).toLocaleString()}만원`
  return `${krw.toLocaleString()}원`
}

/** 메인·갤러리 공통 비율. 웹/모바일 동일 비율 반응형 */
const GALLERY_ASPECT = 'aspect-[4/3]'

type Props = {
  product: GalleryProduct
  priority?: boolean
  /** 메인: 진열 느낌 완화 — 얇은 테두리·차분한 타이포 */
  editorial?: boolean
  /** 상담 예시 카드 — 참고 요금 톤 */
  pickStyle?: boolean
  /** 국내 / 해외 패키지 / 자유·에어텔 등 */
  typeBadge?: string
}

export default function AgentCard({
  product,
  priority = false,
  editorial = false,
  pickStyle = false,
  typeBadge,
}: Props) {
  const departureStr = formatDate(product.departureDate)
  const durationStr = product.duration
  const priceStr = formatPrice(product.priceKrw)
  const hasPrice = product.priceKrw != null && product.priceKrw > 0
  const imageSet = product.imageSet?.length ? product.imageSet : [product.coverImageUrl]

  const editorialShell =
    'rounded-2xl border border-bt-border-soft bg-bt-surface shadow-sm transition-shadow duration-300 hover:shadow-md'
  const shell = editorial || pickStyle ? editorialShell : 'rounded-lg bg-base shadow-md transition-shadow duration-300 hover:shadow-xl'

  const badge =
    editorial || pickStyle
      ? 'rounded-md border border-bt-border-soft bg-bt-surface/95 px-2 py-1 text-[10px] font-medium tracking-wide text-bt-muted backdrop-blur-sm'
      : 'rounded bg-primary/95 px-2 py-1 text-[11px] font-medium tracking-tighter text-white'

  const titleClass =
    editorial || pickStyle
      ? 'line-clamp-2 text-base font-semibold tracking-tight text-bt-strong'
      : 'text-lg font-black tracking-tighter text-primary line-clamp-2'

  const metaClass =
    editorial || pickStyle
      ? 'mt-2 text-xs font-normal text-bt-meta'
      : 'mt-2 text-sm font-medium tracking-tighter text-primary/80'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`group overflow-hidden ${shell}`}
    >
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative overflow-hidden bg-bt-surface-alt">
          <ul className="flex snap-x snap-mandatory overflow-x-auto gap-px">
            {imageSet.map((url, idx) => (
              <li
                key={`${url}-${idx}`}
                className={`relative flex-shrink-0 snap-start w-[42vw] min-w-[140px] max-w-[220px] ${GALLERY_ASPECT} sm:w-[180px] sm:min-w-[160px] sm:max-w-[200px]`}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className={`object-cover ${editorial ? 'transition-transform duration-500 group-hover:scale-[1.02]' : 'transition-transform duration-500 group-hover:scale-105'}`}
                  sizes="(max-width: 640px) 42vw, 180px"
                  priority={priority && idx === 0}
                />
              </li>
            ))}
          </ul>
          <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
            {(editorial || pickStyle) ? (
              <span className={badge}>{formatOriginSourceForDisplay(product.originSource)}</span>
            ) : (
              <>
                {typeBadge ? <span className={badge}>{typeBadge}</span> : null}
                <span className={badge}>{formatOriginSourceForDisplay(product.originSource)}</span>
              </>
            )}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent"
            aria-hidden
          />
        </div>

        <div className={`px-4 ${editorial || pickStyle ? 'py-4' : 'py-4'}`}>
          {(editorial || pickStyle) && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-bt-subtle">상담 가능 일정</p>
          )}
          <h2 className={titleClass}>{product.title}</h2>
          {typeBadge && (editorial || pickStyle) ? (
            <p className="mt-1 text-[10px] text-bt-meta">
              <span className="font-medium text-bt-subtle">유형</span> · {typeBadge}
            </p>
          ) : null}
          <p className={metaClass}>
            {pickStyle ? (
              <>
                출발 {departureStr} · {durationStr}
                {hasPrice ? (
                  <>
                    {' '}
                    · <span className="font-semibold text-bt-price">참고가 {priceStr}~</span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {departureStr} · {durationStr}
                {hasPrice ? (
                  <>
                    {' '}
                    · <span className={editorial ? 'text-bt-price' : 'text-accent font-semibold'}>{priceStr}</span>
                  </>
                ) : (
                  <>
                    {' '}
                    · {priceStr}
                  </>
                )}
              </>
            )}
          </p>
          {pickStyle && hasPrice && (
            <p className="mt-1 text-[10px] text-bt-subtle">출발일별 상이 · 상담 시 확인</p>
          )}
        </div>
      </Link>
    </motion.article>
  )
}
