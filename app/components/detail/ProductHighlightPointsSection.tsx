import { CircleCheck } from 'lucide-react'
import { decodePublicHtmlEntities } from '@/lib/decode-public-html-entities'
import { HIGHLIGHT_LINE_TEXT_CLASS, resolveHighlightPointsForDisplay } from '@/lib/highlight-points-supplier-noise'

function resolveHighlightDisplayText(
  highlightPoints: string | null | undefined,
  highlightPointsRaw: string | null | undefined
): string | null {
  // 공급사 URL·브랜드 프로그램·자사 홍보 줄은 표시하지 않음(저장값 무변경) — 기존 등록 상품도 즉시 적용
  return resolveHighlightPointsForDisplay(highlightPoints, highlightPointsRaw, decodePublicHtmlEntities)
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
          <li key={i} className="flex min-w-0 gap-3 text-sm leading-relaxed text-bt-body">
            <CircleCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-bt-card-accent-strong"
              strokeWidth={2}
              aria-hidden
            />
            {/* 긴 무공백 문자열(URL 등)도 줄바꿈 — 390px에서 페이지 폭을 넓히지 않게 */}
            <span className={HIGHLIGHT_LINE_TEXT_CLASS}>{line}</span>
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
