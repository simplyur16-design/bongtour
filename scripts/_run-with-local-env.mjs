import dotenv from 'dotenv'
import { spawnSync } from 'child_process'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const cmd = process.argv.slice(2)
if (cmd.length === 0) {
  console.error('usage: node scripts/_run-with-local-env.mjs <command...>')
  process.exit(1)
}

const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: process.env, shell: true })
process.exit(r.status ?? 1)
