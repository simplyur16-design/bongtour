import SeasonCurationHeroClient from '@/app/components/home/SeasonCurationHeroClient'
import { getCachedSeasonCurationHeroSlides } from '@/lib/season-curation-content'

type Props = { sectionId?: string }

export default async function SeasonCurationHero({ sectionId }: Props) {
  const slides = await getCachedSeasonCurationHeroSlides()
  if (slides.length === 0) return null
  return <SeasonCurationHeroClient slides={slides} sectionId={sectionId} />
}
