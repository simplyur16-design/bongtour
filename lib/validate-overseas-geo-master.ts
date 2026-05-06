/**
 * I-5: F-1 적용 전 마스터(Continent / Country / City) 정합 검증.
 */
import type { Prisma } from '@prisma/client'

export type MasterPrimaryGeo = {
  continentKey: string
  countryKey: string
  cityKey: string | null
}

export type ValidatedMasterPrimary = {
  country: { countryKey: string; continentKey: string; koreanLabel: string }
  city: { cityKey: string; countryKey: string; koreanLabel: string } | null
}

export async function validateOverseasGeoFromMaster(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  primary: MasterPrimaryGeo,
): Promise<{ ok: true; validated: ValidatedMasterPrimary } | { ok: false; reason: string }> {
  const ck = primary.continentKey.trim()
  const countryKey = primary.countryKey.trim()
  const cityKey = primary.cityKey?.trim() || null
  if (!ck || !countryKey) return { ok: false, reason: 'missing_primary_keys' }

  const continent = await db.continent.findUnique({ where: { continentKey: ck } })
  if (!continent) return { ok: false, reason: 'master_continent_not_found' }

  const country = await db.country.findUnique({
    where: { countryKey },
    select: { countryKey: true, continentKey: true, koreanLabel: true, isActive: true },
  })
  if (!country || !country.isActive) return { ok: false, reason: 'master_country_not_found' }
  if (country.continentKey !== ck) return { ok: false, reason: 'continent_country_mismatch' }

  if (!cityKey) {
    return { ok: true, validated: { country, city: null } }
  }

  const city = await db.city.findUnique({
    where: { cityKey },
    select: { cityKey: true, countryKey: true, koreanLabel: true, isActive: true },
  })
  if (!city || !city.isActive) return { ok: false, reason: 'master_city_not_found' }
  if (city.countryKey !== countryKey) return { ok: false, reason: 'city_country_mismatch' }

  return { ok: true, validated: { country, city } }
}
