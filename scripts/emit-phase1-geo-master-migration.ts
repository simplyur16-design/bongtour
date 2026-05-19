/**
 * Phase1 Supabase 마이그 SQL 생성 (트리 시드 upsert + 메가메뉴 카드 패치).
 *   npx tsx scripts/emit-phase1-geo-master-migration.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { OVERSEAS_LOCATION_TREE_DATA } from '@/lib/overseas-location-tree.data'
import { buildMasterSeedFromTree } from './seed-master-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const OUT = join(REPO_ROOT, 'supabase', 'migrations', '20260520120000_phase1_geo_master_seed.sql')

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function main(): void {
  const seed = buildMasterSeedFromTree(OVERSEAS_LOCATION_TREE_DATA)
  const lines: string[] = [
    '-- Phase 1: Continent/Country/City 마스터 시드 정합 + MegaMenuGroupCard 패치',
    '-- 생성: npx tsx scripts/emit-phase1-geo-master-migration.ts',
    '-- SSOT: lib/overseas-location-tree.data.ts → scripts/seed-master-data.ts',
    '-- 수동 apply (Supabase MCP apply_migration). PR2에서 UI/browse SSOT 통합.',
    '',
  ]

  for (const c of seed.continents) {
    lines.push(
      `INSERT INTO "Continent" ("continentKey", "koreanLabel", "sortOrder") VALUES (${q(c.continentKey)}, ${q(c.koreanLabel)}, ${c.sortOrder}) ON CONFLICT ("continentKey") DO UPDATE SET "koreanLabel" = EXCLUDED."koreanLabel", "sortOrder" = EXCLUDED."sortOrder";`,
    )
  }
  lines.push('')

  for (const c of seed.countries) {
    lines.push(
      `INSERT INTO "Country" ("countryKey", "continentKey", "koreanLabel", "sortOrder", "isActive") VALUES (${q(c.countryKey)}, ${q(c.continentKey)}, ${q(c.koreanLabel)}, ${c.sortOrder}, ${c.isActive}) ON CONFLICT ("countryKey") DO UPDATE SET "continentKey" = EXCLUDED."continentKey", "koreanLabel" = EXCLUDED."koreanLabel", "sortOrder" = EXCLUDED."sortOrder", "isActive" = EXCLUDED."isActive";`,
    )
  }
  lines.push('')

  for (const c of seed.cities) {
    lines.push(
      `INSERT INTO "City" ("cityKey", "countryKey", "koreanLabel", "sortOrder", "isMajor", "isActive") VALUES (${q(c.cityKey)}, ${q(c.countryKey)}, ${q(c.koreanLabel)}, ${c.sortOrder}, ${c.isMajor}, ${c.isActive}) ON CONFLICT ("cityKey") DO UPDATE SET "countryKey" = EXCLUDED."countryKey", "koreanLabel" = EXCLUDED."koreanLabel", "sortOrder" = EXCLUDED."sortOrder", "isMajor" = EXCLUDED."isMajor", "isActive" = EXCLUDED."isActive";`,
    )
  }
  lines.push('')

  const patchPath = join(REPO_ROOT, 'supabase', 'migrations', '20260510120000_megamenu_card_seed_patch.sql')
  const patch = readFileSync(patchPath, 'utf8')
  lines.push('-- MegaMenuGroupCard + Country/City links (20260510120000 패치 본문)')
  lines.push(patch.trim())
  lines.push('')

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, lines.join('\n'), 'utf8')
  console.log('[emit-phase1] wrote', OUT, `(${lines.length} lines)`)
}

main()
