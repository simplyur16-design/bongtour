import PersonaTabsClient from '@/app/components/home/PersonaTabsClient'
import { getPersonaCuratedDestinationsPayload } from '@/lib/persona-curated-destinations'
import { MAIN_PERSONA_SECTION_TITLE } from '@/lib/main-hub-copy'

/**
 * 메인 영역 6 — 페르소나 큐레이션 추천 여행지 (서버 prefetch + 클라이언트 탭).
 * PC(`lg` 이상)만 노출 — 모바일은 `app/page.tsx`에서 `hidden lg:block` 래핑(4카드와 시각적 혼동 방지).
 */
export default async function PersonaCuratedDestinations() {
  const data = await getPersonaCuratedDestinationsPayload()
  return (
    <section
      aria-labelledby="persona-curated-heading"
      className="border-y border-bt-border-soft/60 bg-bt-bg-lavender/35 px-3 py-10 sm:px-5"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="persona-curated-heading"
          className="text-center text-2xl font-bold tracking-tight text-bt-text-navy sm:text-[26px]"
        >
          {MAIN_PERSONA_SECTION_TITLE}
        </h2>
        <PersonaTabsClient cards={data.cards} />
      </div>
    </section>
  )
}
