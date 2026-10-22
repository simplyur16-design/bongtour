import { redirect } from 'next/navigation'
import { SIMILAR_ITINERARY_COMPARE_PATH } from '@/lib/similar-itinerary-compare-href'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** legacy /dev → public travel path */
export default async function SimilarItineraryCompareDevRedirect({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {}
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string' && v) qs.set(k, v)
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0])
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`${SIMILAR_ITINERARY_COMPARE_PATH}${suffix}`)
}
