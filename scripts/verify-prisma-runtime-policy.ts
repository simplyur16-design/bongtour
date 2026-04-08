import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function fail(msg: string): never {
  console.error(`[verify:prisma-runtime-policy] ${msg}`)
  process.exit(1)
}

function ensureBaseConfig() {
  const schema = read('prisma/schema.prisma')
  if (!/provider\s*=\s*"sqlite"/.test(schema)) {
    fail('schema datasource provider must stay sqlite')
  }
  if (!/output\s*=\s*"\.\.\/prisma-gen-runtime"/.test(schema)) {
    fail('schema generator output must be ../prisma-gen-runtime')
  }

  const tsconfig = read('tsconfig.json')
  if (!/"@prisma\/client"\s*:\s*\["\.\/prisma-gen-runtime"\]/.test(tsconfig)) {
    fail('tsconfig path alias @prisma/client must point to ./prisma-gen-runtime')
  }
  if (!/"@prisma\/client\/\*"\s*:\s*\["\.\/prisma-gen-runtime\/\*"\]/.test(tsconfig)) {
    fail('tsconfig path alias @prisma/client/* must point to ./prisma-gen-runtime/*')
  }

  const prismaSingleton = read('lib/prisma.ts')
  if (/withAccelerate/.test(prismaSingleton)) {
    fail('lib/prisma.ts must not use withAccelerate()')
  }
  if (!/new PrismaClient\(/.test(prismaSingleton)) {
    fail('lib/prisma.ts must construct PrismaClient (plain options allowed; no Accelerate)')
  }
}

function collectFiles(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git' || name === 'docs') continue
    const full = join(dir, name)
    const rel = full.replace(root + '\\', '').replaceAll('\\', '/')
    if (rel.startsWith('prisma-gen/') || rel.startsWith('prisma-gen-runtime/')) continue
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, out)
      continue
    }
    const ext = extname(name).toLowerCase()
    if (['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml'].includes(ext)) out.push(rel)
  }
}

function ensureNoBannedPatterns() {
  const files: string[] = []
  collectFiles(root, files)
  for (const rel of files) {
    if (rel === 'scripts/verify-prisma-runtime-policy.ts') continue
    const text = read(rel)
    if (text.includes('withAccelerate(')) {
      fail(`withAccelerate() is forbidden in runtime policy: ${rel}`)
    }
    if (text.includes('--no-engine')) {
      fail(`--no-engine usage detected outside docs: ${rel}`)
    }
    if (/(^|[/"'\\])prisma-gen([/"'\\]|$)/.test(text)) {
      fail(`legacy prisma-gen reference detected: ${rel}`)
    }
  }
}

function run() {
  ensureBaseConfig()
  ensureNoBannedPatterns()
  console.log('OK: prisma runtime policy is enforced')
}

run()
