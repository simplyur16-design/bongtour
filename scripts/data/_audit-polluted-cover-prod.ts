import '../load-env-for-scripts'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const pollutedLike = await p.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "Product"
     WHERE "registrationStatus"='registered'
       AND (
         COALESCE("primaryDestination",'') ~ '(공장|가든|사이클링|식비|덴마구|실속|금까|주조|스위트피아|해안선|&harr|The Rocks|중국권)'
         OR COALESCE(destination,'') ~ '(공장|가든|사이클링|식비|덴마구|실속|금까|주조|&harr)'
         OR title ~ '(&harr|&rarr|주조공장|자유\\s*식비)'
       )`,
  )
  const noCover = await p.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "Product"
     WHERE "registrationStatus"='registered'
       AND ("bgImageUrl" IS NULL OR btrim("bgImageUrl") = '')`,
  )
  const noCoverWithSchedImg = await p.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM "Product"
     WHERE "registrationStatus"='registered'
       AND ("bgImageUrl" IS NULL OR btrim("bgImageUrl") = '')
       AND schedule IS NOT NULL
       AND schedule ILIKE '%imageUrl%'`,
  )
  const sample = await p.$queryRawUnsafe<
    { originCode: string; title: string; dest: string; has_bg: number }[]
  >(
    `SELECT "originCode",
            left(title, 70) AS title,
            left(COALESCE("primaryDestination",''), 50) AS dest,
            CASE WHEN "bgImageUrl" IS NULL OR btrim("bgImageUrl")='' THEN 0 ELSE 1 END AS has_bg
     FROM "Product"
     WHERE "registrationStatus"='registered'
       AND (
         COALESCE("primaryDestination",'') ~ '(공장|가든|사이클링|식비|덴마구|실속|금까|주조|스위트피아|&harr)'
         OR title ~ '(&harr|주조공장|자유\\s*식비)'
       )
     LIMIT 25`,
  )
  console.log(
    JSON.stringify(
      {
        pollutedLike: pollutedLike[0]?.n ?? 0,
        noCover: noCover[0]?.n ?? 0,
        noCoverWithSchedImg: noCoverWithSchedImg[0]?.n ?? 0,
        sample,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await p.$disconnect()
  })
