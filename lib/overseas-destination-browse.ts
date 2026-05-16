import { prisma } from '@/lib/prisma'

export type OverseasGeoFilterBanner = {
  title: string
  cityKey: string | null
  countryKey: string | null
}

function pickParam(v: string | string[] | undefined): string | null {
  if (typeof v === 'string') {
    const t = v.trim()
    return t || null
  }
  return null
}

/** `/travel/overseas` — `destination`(cityKey)·`country`(countryKey) 쿼리 해석 + 한글 헤더. */
export async function resolveOverseasGeoFilterBanner(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<OverseasGeoFilterBanner | null> {
  const destination = pickParam(searchParams.destination)
  const cityKey = pickParam(searchParams.city) ?? destination
  const countryKey = pickParam(searchParams.country)

  if (!cityKey && !countryKey) return null

  if (cityKey) {
    const city = await prisma.city.findUnique({
      where: { cityKey },
      select: { cityKey: true, koreanLabel: true, countryKey: true },
    })
    if (city) {
      return {
        title: `${city.koreanLabel} 여행상품`,
        cityKey: city.cityKey,
        countryKey: countryKey ?? city.countryKey,
      }
    }
    return {
      title: `${cityKey} 여행상품`,
      cityKey,
      countryKey,
    }
  }

  const country = await prisma.country.findUnique({
    where: { countryKey: countryKey! },
    select: { countryKey: true, koreanLabel: true },
  })
  return {
    title: `${country?.koreanLabel ?? countryKey} 여행상품`,
    cityKey: null,
    countryKey: countryKey!,
  }
}
