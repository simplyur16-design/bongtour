import { CircleCheck } from 'lucide-react'

function resolveHighlightDisplayText(
  highlightPoints: string | null | undefined,
  highlightPointsRaw: string | null | undefined
): string | null {
  if (typeof highlightPoints === 'string' && highlightPoints.trim()) {
    return highlightPoints.replace(/\r/g, '\n')
  }
  if (typeof highlightPointsRaw === 'string' && highlightPointsRaw.trim()) {
    return highlightPointsRaw.replace(/\r/g, '\n')
  }
  return null
}

function stripLeadingBullet(line: string): string {
  return line.replace(/^[\s\-–—\*•·∙※✔✓☑√★☆►▶]+\s*/, '').trim()
}

type Props = {
  highlightPoints?: string | null
  highlightPointsRaw?: string | null
  /** 모바일 상세는 상위 `p-4` 래퍼와 맞추기 위해 패딩 생략 */
  compact?: boolean
}

export default function ProductHighlightPointsSection({
  highlightPoints,
  highlightPointsRaw,
  compact = false,
}: Props) {
  const raw = resolveHighlightDisplayText(highlightPoints, highlightPointsRaw)
  if (!raw) return null
  const lines = raw
    .split(/\n/)
    .map((l) => stripLeadingBullet(l.trim()))
    .filter(Boolean)
  if (lines.length === 0) return null

  const pad = compact ? '' : 'p-5 sm:p-6'
  const inner = (
    <section
      className={`rounded-2xl border border-bt-border bg-gradient-to-br from-bt-surface to-bt-card-accent-soft/30 shadow-sm ${pad}`}
      aria-labelledby="product-highlight-points-heading"
    >
      <h2
        id="product-highlight-points-heading"
        className={`mb-4 flex items-center gap-2 font-semibold text-bt-card-title ${compact ? 'text-base' : 'text-lg'}`}
      >
        <span className={compact ? 'text-lg' : 'text-xl'} aria-hidden>
          ✨
        </span>
        상품 핵심 포인트
      </h2>
      <ul className="space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-bt-body">
            <CircleCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-bt-card-accent-strong"
              strokeWidth={2}
              aria-hidden
            />
            <span className="min-w-0 whitespace-pre-wrap">{line}</span>
          </li>
        ))}
      </ul>
    </section>
  )
  if (compact) {
    return <div className="border-b border-bt-border-soft p-4">{inner}</div>
  }
  return inner
}
