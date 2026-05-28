import { prisma } from '@/lib/prisma'

const ENTITY_TYPE = 'bongsim_esim_country'
const IMAGE_ROLE = 'recommend_hero'

/** GET /api/bongsim/country-heroes — DB SSOT */
export async function loadBongsimCountryHeroesMap(): Promise<Record<string, string>> {
  const rows = await prisma.imageAsset.findMany({
    where: {
      entityType: ENTITY_TYPE,
      imageRole: IMAGE_ROLE,
      isPrimary: true,
    },
    select: {
      entityId: true,
      publicUrl: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const heroes: Record<string, string> = {}
  for (const r of rows) {
    const code = r.entityId.trim().toLowerCase()
    const url = r.publicUrl.trim()
    if (!code || !url) continue
    if (heroes[code] !== undefined) continue
    heroes[code] = url
  }
  return heroes
}
