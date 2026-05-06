/**
 * H-3: 해외 지리 키를 DB 마스터(OverseasGroup/Country/Node)로 검증·한글 country/city 확정.
 */
import type { PrismaClient } from '@prisma/client'

export type OverseasGeoResolved = {
  groupKey: string
  continent: string
  countryKey: string
  nodeKey: string | null
  country: string
  city: string | null
}

export type OverseasMasterDb = Pick<PrismaClient, 'overseasGroup' | 'overseasCountry' | 'overseasNode'>

export async function validateOverseasGeoFromMaster(
  db: OverseasMasterDb,
  input: { groupKey: string; countryKey: string; nodeKey?: string | null },
): Promise<{ ok: true; resolved: OverseasGeoResolved } | { ok: false; reason: string }> {
  const gk = (input.groupKey ?? '').trim()
  const ck = (input.countryKey ?? '').trim()
  const nkRaw = input.nodeKey
  const nk =
    nkRaw === null || nkRaw === undefined ? null : typeof nkRaw === 'string' ? nkRaw.trim() || null : null

  if (!gk || !ck) {
    return { ok: false, reason: 'missing_group_or_country_key' }
  }

  const group = await db.overseasGroup.findUnique({ where: { groupKey: gk } })
  if (!group) return { ok: false, reason: `unknown_groupKey:${gk}` }

  const country = await db.overseasCountry.findFirst({
    where: { countryKey: ck, groupKey: gk },
  })
  if (!country) return { ok: false, reason: `country_not_in_group:${ck}@${gk}` }

  if (!nk) {
    return {
      ok: true,
      resolved: {
        groupKey: gk,
        continent: group.continent,
        countryKey: ck,
        nodeKey: null,
        country: country.koreanLabel,
        city: null,
      },
    }
  }

  const node = await db.overseasNode.findFirst({
    where: { nodeKey: nk, countryKey: ck },
  })
  if (!node) return { ok: false, reason: `unknown_nodeKey:${nk}@${ck}` }

  return {
    ok: true,
    resolved: {
      groupKey: gk,
      continent: group.continent,
      countryKey: ck,
      nodeKey: nk,
      country: country.koreanLabel,
      city: node.koreanLabel,
    },
  }
}
