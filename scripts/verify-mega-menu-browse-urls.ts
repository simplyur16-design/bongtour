/**
 * @deprecated `npx tsx scripts/verify-mega-menu-ssot-browse.ts` 로 통합됨.
 */
import { spawnSync } from 'child_process'

const r = spawnSync('npx', ['tsx', 'scripts/verify-mega-menu-ssot-browse.ts'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
})
process.exit(r.status ?? 1)
