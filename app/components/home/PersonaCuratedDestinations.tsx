import PersonaTabsClient from '@/app/components/home/PersonaTabsClient'
import { getPersonaCuratedDestinationsPayload } from '@/lib/persona-curated-destinations'
import { getCachedCurrentCycle } from '@/lib/season-curation-content'
import { MAIN_PERSONA_SECTION_TITLE } from '@/lib/main-hub-copy'

/**
 * 메인 영역 6 — 페르소나 큐레이션 추천 여행지 (서버 prefetch + 클라이언트 탭).
 * PC 트리만 렌더 — 모바일은 `app/page.tsx` UA 단일 SSR에서 제외.
 */
export default async function PersonaCuratedDestinations() {
  let data: Awaited<ReturnType<typeof getPersonaCuratedDestinationsPayload>>
  try {
    const cycle = await getCachedCurrentCycle()
    data = await getPersonaCuratedDestinationsPayload(cycle)
  } catch (e) {
    console.error('[PersonaCuratedDestinations]', e)
    return null
  }
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
