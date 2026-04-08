import type { ReactNode } from 'react'
import { MAIN_GALLERY_LEAD, MAIN_GALLERY_TITLE } from '@/lib/main-hub-copy'

type Props = {
  children: ReactNode
}

/**
 * 보조 섹션 — 상담 가능 일정. 시각적 무게 낮춤.
 */
export default function HomeGalleryBand({ children }: Props) {
  return (
    <section
      id="gallery-consult"
      className="scroll-mt-24 border-t border-bt-border bg-bt-page py-10 sm:py-12"
      aria-labelledby="home-gallery-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bt-subtle">Reference</p>
          <h2 id="home-gallery-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-bt-ink sm:text-xl">
            {MAIN_GALLERY_TITLE}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-bt-muted">{MAIN_GALLERY_LEAD}</p>
        </div>
      </div>
      <div className="mt-6 opacity-[0.92]">{children}</div>
    </section>
  )
}
