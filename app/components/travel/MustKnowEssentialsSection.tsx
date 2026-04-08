import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import {
  buildMustKnowDisplayLines,
  groupHanatourMustKnowLines,
  type PublicMustKnowItemInput,
} from '@/lib/public-must-know-display'

const EMPTY_HINT =
  '여권·입국 절차·자녀 동반 서류·전압/유심·현지 결제 등은 출발 전 최신 기준을 확인해 주세요.'

type Props = {
  /** `filterPublicMustKnowItemsForTripReadiness` 적용 후 배열 */
  items: PublicMustKnowItemInput[]
  layout: 'desktop' | 'mobile'
  /** 하나투어: bullet 분리·우선순위 정렬에 사용 */
  originSource?: string | null
}

/**
 * 꼭 알아야 할 사항 — 카드 1개 + bullet 리스트 (항목별 카드 반복 없음).
 */
export default function MustKnowEssentialsSection({ items, layout, originSource }: Props) {
  const lines = buildMustKnowDisplayLines(items, { originSource })
  const hanatourGroups =
    normalizeSupplierOrigin(originSource ?? '') === 'hanatour' ? groupHanatourMustKnowLines(lines) : null
  const sectionClass =
    layout === 'desktop'
      ? 'rounded-2xl border border-bt-border-strong bg-bt-surface p-6'
      : 'border-b border-bt-border-soft p-4'
  const titleMb = layout === 'desktop' ? 'mb-4' : 'mb-3'

  return (
    <section className={sectionClass}>
      <h2 className={`${titleMb} text-center text-base font-semibold text-bt-card-title`}>
        꼭 알아야 할 사항
      </h2>
      {lines.length > 0 ? (
        <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/70 p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium text-bt-body">출발 전/현지에서 꼭 확인하세요.</p>
          {hanatourGroups ? (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-bt-card-title">입국·비자·세관 안내</p>
                <ul className="list-outside list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-bt-body marker:text-bt-card-accent-strong">
                  {hanatourGroups.primary.map((line, idx) => (
                    <li key={`p_${idx}`} className="bt-wrap">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              {hanatourGroups.rest.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-bt-card-title">기타 유의사항</p>
                  <ul className="list-outside list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-bt-body marker:text-bt-card-accent-strong">
                    {hanatourGroups.rest.map((line, idx) => (
                      <li key={`r_${idx}`} className="bt-wrap">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="list-outside list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-bt-body marker:text-bt-card-accent-strong">
              {lines.map((line, idx) => (
                <li key={idx} className="bt-wrap">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="bt-wrap text-center text-sm text-bt-meta">{EMPTY_HINT}</p>
      )}
    </section>
  )
}
