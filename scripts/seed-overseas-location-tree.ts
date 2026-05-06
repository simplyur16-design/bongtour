/**
 * H-2: 코드 트리 SSOT(`overseas-location-tree.data`) → DB 마스터 시드.
 *
 *   npm run seed:overseas-tree              # dry-run (기본)
 *   npm run seed:overseas-tree:apply      # DB 반영
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
import { OVERSEAS_LOCATION_TREE_CLEAN } from '@/lib/overseas-location-tree'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

const apply = process.argv.includes('--apply')

async function main() {
  const prisma = new PrismaClient()
  const nodeOwner = new Map<string, string>()
  let groupCount = 0
  let countryCount = 0
  let leafCount = 0

  try {
    for (let gi = 0; gi < OVERSEAS_LOCATION_TREE_CLEAN.length; gi++) {
      const group = OVERSEAS_LOCATION_TREE_CLEAN[gi]!
      groupCount++
      const firstCk = group.countries[0]?.countryKey ?? ''
      const continent = continentTabIdForMatch(group.groupKey, firstCk)
      const groupRow = {
        groupKey: group.groupKey,
        koreanLabel: group.groupLabel.trim(),
        continent,
        sortOrder: gi,
      }
      if (apply) {
        await prisma.overseasGroup.upsert({
          where: { groupKey: group.groupKey },
          create: groupRow,
          update: {
            koreanLabel: groupRow.koreanLabel,
            continent: groupRow.continent,
            sortOrder: groupRow.sortOrder,
          },
        })
      }

      for (let ci = 0; ci < group.countries.length; ci++) {
        const country = group.countries[ci]!
        countryCount++
        const countryRow = {
          countryKey: country.countryKey,
          groupKey: group.groupKey,
          koreanLabel: country.countryLabel.trim(),
          sortOrder: ci,
          isActive: true,
        }
        if (apply) {
          await prisma.overseasCountry.upsert({
            where: { countryKey: country.countryKey },
            create: countryRow,
            update: {
              groupKey: group.groupKey,
              koreanLabel: countryRow.koreanLabel,
              sortOrder: ci,
              isActive: true,
            },
          })
        }

        for (let li = 0; li < country.children.length; li++) {
          const leaf = country.children[li]!
          leafCount++
          const owner = nodeOwner.get(leaf.nodeKey)
          if (owner && owner !== country.countryKey) {
            throw new Error(
              `duplicate nodeKey "${leaf.nodeKey}" (countries ${owner} vs ${country.countryKey}) — PK 불가`,
            )
          }
          nodeOwner.set(leaf.nodeKey, country.countryKey)
          const nodeRow = {
            nodeKey: leaf.nodeKey,
            countryKey: country.countryKey,
            koreanLabel: leaf.nodeLabel.trim(),
            sortOrder: li,
            isActive: true,
          }
          if (apply) {
            await prisma.overseasNode.upsert({
              where: { nodeKey: leaf.nodeKey },
              create: nodeRow,
              update: {
                countryKey: country.countryKey,
                koreanLabel: nodeRow.koreanLabel,
                sortOrder: li,
                isActive: true,
              },
            })
          }
        }
      }
    }

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      groups: groupCount,
      countries: countryCount,
      leaves: leafCount,
      uniqueNodeKeys: nodeOwner.size,
      source: 'OVERSEAS_LOCATION_TREE_CLEAN',
    }
    console.log(JSON.stringify(summary, null, 2))

    if (apply) {
      const [g, co, no] = await Promise.all([
        prisma.overseasGroup.count(),
        prisma.overseasCountry.count(),
        prisma.overseasNode.count(),
      ])
      console.log(JSON.stringify({ dbCounts: { OverseasGroup: g, OverseasCountry: co, OverseasNode: no } }, null, 2))
    }
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
