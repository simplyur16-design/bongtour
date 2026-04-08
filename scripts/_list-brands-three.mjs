import { PrismaClient } from '../prisma-gen-runtime/index.js'
const p = new PrismaClient()
const rows = await p.brand.findMany({
  where: { brandKey: { in: ['verygoodtour', 'modetour', 'ybtour'] } },
  orderBy: { brandKey: 'asc' },
  select: { id: true, brandKey: true, displayName: true },
})
console.log(JSON.stringify(rows, null, 2))
await p.$disconnect()
