/**
 * 공급사별 등록 상세카드 자동수집 — 순차 커밋 (manifest 누적).
 * 실행: npx tsx scripts/commit-register-detail-collect-suppliers.ts
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

type Manifest = {
  npmScripts: Array<{ id: string; [k: string]: unknown }>
  staticGuards: Array<{ id: string; [k: string]: unknown }>
  [k: string]: unknown
}

type PkgJson = { scripts: Record<string, string>; [k: string]: unknown }

const MANIFEST_PATH = 'scripts/regression-freeze-manifest.json'
const PKG_PATH = 'package.json'
const finalManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
const finalPkg = JSON.parse(readFileSync(PKG_PATH, 'utf8')) as PkgJson
const headManifest = JSON.parse(
  execSync(`git show HEAD:${MANIFEST_PATH}`, { encoding: 'utf8' }),
) as Manifest

const DETAIL_GUARD_IDS = [
  'modetour-register-detail-collect',
  'hanatour-register-detail-collect',
  'verygoodtour-register-detail-collect',
  'kyowontour-tour-event-tab-opt-shop',
  'ybtour-register-detail-collect',
  'lottetour-register-detail-collect',
] as const

const NPM_IDS = ['kyowontour-tour-event-tab-opt-shop'] as const

function mergeManifest(upToIndex: number): void {
  const guardIds = DETAIL_GUARD_IDS.slice(0, upToIndex + 1)
  const npmIds = NPM_IDS.filter((id) => guardIds.includes(id as (typeof DETAIL_GUARD_IDS)[number]))

  const baseGuards = headManifest.staticGuards.filter(
    (g) => !DETAIL_GUARD_IDS.includes(g.id as (typeof DETAIL_GUARD_IDS)[number]),
  )
  const addGuards = finalManifest.staticGuards.filter((g) =>
    guardIds.includes(g.id as (typeof DETAIL_GUARD_IDS)[number]),
  )
  const baseNpm = headManifest.npmScripts.filter((n) => !NPM_IDS.includes(n.id as (typeof NPM_IDS)[number]))
  const addNpm = finalManifest.npmScripts.filter((n) => npmIds.includes(n.id as (typeof NPM_IDS)[number]))

  const merged: Manifest = {
    ...headManifest,
    npmScripts: [...baseNpm, ...addNpm],
    staticGuards: [...baseGuards, ...addGuards],
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(merged, null, 2)}\n`)
}

const COMMITS: Array<{ message: string; files: string[]; manifestIndex: number; packageJson?: boolean }> = [
  {
    message: 'feat(modetour): connect register detail card auto-collect to augment pipeline',
    manifestIndex: 0,
    files: [
      'lib/modetour-register-detail-collect.ts',
      'lib/modetour-register-detail-collect.test.ts',
      'lib/parse-and-register-modetour-handler.ts',
      'lib/register-llm-schema-modetour.ts',
    ],
  },
  {
    message: 'feat(hanatour): connect register detail card auto-collect via gw API',
    manifestIndex: 1,
    files: [
      'lib/hanatour-register-api-detail.ts',
      'lib/hanatour-register-detail-collect.ts',
      'lib/hanatour-register-detail-collect.test.ts',
      'lib/parse-and-register-hanatour-handler.ts',
      'lib/parse-and-register-hanatour-orchestration.ts',
      'lib/register-facts/hanatour.ts',
      'lib/register-llm-schema-hanatour.ts',
    ],
  },
  {
    message: 'feat(verygoodtour): connect register detail card auto-collect from PackageDetail HTML',
    manifestIndex: 2,
    files: [
      'lib/verygoodtour-register-detail-collect.ts',
      'lib/verygoodtour-register-detail-collect.test.ts',
      'lib/parse-and-register-verygoodtour-handler.ts',
      'lib/verygoodtour-departures.ts',
      'lib/verygoodtour-itinerary-collector.ts',
      'lib/register-llm-schema-verygoodtour.ts',
    ],
  },
  {
    message: 'feat(kyowontour): connect register detail card auto-collect via goodsEvtTab AJAX',
    manifestIndex: 3,
    packageJson: true,
    files: [
      'lib/kyowontour-tour-event-tab-data.ts',
      'lib/kyowontour-tour-event-tab-data.test.ts',
      'lib/kyowontour-register-tab-data-collect.ts',
      'lib/kyowontour-register-tab-data-collect.test.ts',
      'lib/kyowontour-register-schedule-collect.ts',
      'lib/kyowontour-register-schedule-collect.test.ts',
      'lib/kyowontour-register-opt-shop-collect.ts',
      'lib/kyowontour-register-opt-shop-collect.test.ts',
      'lib/parse-and-register-kyowontour-handler.ts',
      'lib/parse-and-register-kyowontour-orchestration.ts',
      'lib/register-llm-schema-kyowontour.ts',
      'scripts/verify-kyowontour-tour-event-tab-opt-shop.ts',
    ],
  },
  {
    message: 'feat(ybtour): connect register detail card auto-collect via papi notice and schedule',
    manifestIndex: 4,
    files: [
      'lib/ybtour-register-api-detail.ts',
      'lib/ybtour-register-detail-collect.ts',
      'lib/ybtour-register-detail-collect.test.ts',
      'lib/parse-and-register-ybtour-handler.ts',
      'lib/parse-and-register-ybtour-orchestration.ts',
      'lib/register-llm-schema-ybtour.ts',
    ],
  },
  {
    message: 'feat(lottetour): connect register detail card auto-collect via evtDetailBasicAjax',
    manifestIndex: 5,
    files: [
      'lib/lottetour-register-api-detail.ts',
      'lib/lottetour-register-detail-collect.ts',
      'lib/lottetour-register-detail-collect.test.ts',
      'lib/parse-and-register-lottetour-handler.ts',
      'lib/parse-and-register-lottetour-orchestration.ts',
      'lib/register-llm-schema-lottetour.ts',
      'scripts/verify-register-detail-collect-live.ts',
    ],
  },
]

function sh(cmd: string): void {
  execSync(cmd, { stdio: 'inherit', encoding: 'utf8' })
}

function patchPackageJsonForKyowontourVerify(): void {
  const head = JSON.parse(execSync(`git show HEAD:${PKG_PATH}`, { encoding: 'utf8' })) as PkgJson
  const scriptKey = 'verify:kyowontour-tour-event-tab-opt-shop'
  if (finalPkg.scripts[scriptKey]) {
    head.scripts = { ...head.scripts, [scriptKey]: finalPkg.scripts[scriptKey] }
  }
  writeFileSync(PKG_PATH, `${JSON.stringify(head, null, 2)}\n`)
}

for (const c of COMMITS) {
  mergeManifest(c.manifestIndex)
  sh(`git add ${MANIFEST_PATH}`)
  for (const f of c.files) sh(`git add ${f}`)
  if (c.packageJson) {
    patchPackageJsonForKyowontourVerify()
    sh(`git add ${PKG_PATH}`)
  }
  sh(`git commit -m "${c.message.replace(/"/g, '\\"')}"`)
  console.log(`\n✓ ${c.message}\n`)
}

// restore full manifest if other unrelated guard entries exist in working tree
writeFileSync(MANIFEST_PATH, `${JSON.stringify(finalManifest, null, 2)}\n`)
console.log('Done — 6 commits created. Remaining manifest diff (if any) is unrelated sweep entries.')
