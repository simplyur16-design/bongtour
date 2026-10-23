/**
 * lib/mega-menu-discover-parents → listing_discover_shared JSON.
 *   npx tsx scripts/generate-mega-menu-discover-parents.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { buildMegaMenuDiscoverParentsMap } from '@/lib/mega-menu-discover-parents'

const outDir = path.join(__dirname, 'listing_discover_shared')
mkdirSync(outDir, { recursive: true })
const map = buildMegaMenuDiscoverParentsMap()
const outPath = path.join(outDir, 'mega_menu_parents.json')
writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({ outPath, leafCount: Object.keys(map).length }, null, 2))
