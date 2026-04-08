'use client'

import type { PublicPasteDisplayBlock } from '@/lib/paste-block-display'

type Props = {
  blocks: PublicPasteDisplayBlock[]
  /** 카드 상단 라벨 (예: 현지옵션 입력 / 쇼핑 입력) */
  sectionLabel: string
  accentClassName?: string
}

export default function PasteBlocksReaderView({ blocks, sectionLabel, accentClassName }: Props) {
  if (!blocks.length) return null
  const accent = accentClassName ?? 'text-bt-card-accent-strong'

  return (
    <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-left">
      <p className={`text-center text-xs font-bold uppercase tracking-[0.12em] ${accent}`}>{sectionLabel}</p>
      <div className="mt-4 space-y-4">
        {blocks.map((b, i) => (
          <article
            key={`${b.title.slice(0, 24)}_${i}`}
            className="rounded-lg border border-bt-border-soft/80 bg-bt-surface/90 px-3 py-3 shadow-sm"
          >
            {b.title ? <h4 className="text-sm font-bold text-bt-card-title">{b.title}</h4> : null}
            {b.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bt-body">{b.description}</p>
            ) : null}
            <dl className="mt-2 space-y-1.5 text-xs text-bt-body">
              {b.price ? (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-semibold text-bt-meta">가격</dt>
                  <dd className="min-w-0 flex-1 font-medium">{b.price}</dd>
                </div>
              ) : null}
              {b.duration ? (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-semibold text-bt-meta">소요</dt>
                  <dd className="min-w-0 flex-1">{b.duration}</dd>
                </div>
              ) : null}
              {b.note ? (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-semibold text-bt-meta">비고</dt>
                  <dd className="min-w-0 flex-1 whitespace-pre-wrap">{b.note}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
