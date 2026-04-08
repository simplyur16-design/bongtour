/**
 * Remove Next.js output + webpack-related caches (dev 산출물 꼬임 복구용).
 * - `.next` 전체 (server/vendor-chunks, cache/webpack 등 포함)
 * - `node_modules/.cache` 가 있으면 제거 (webpack/babel 캐시로 ENOENT·resolve 실패가 이어질 수 있음)
 */
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const nextDir = path.join(root, '.next')
const nodeModulesCache = path.join(root, 'node_modules', '.cache')

try {
  fs.rmSync(nextDir, { recursive: true, force: true })
  console.log('[clean-next] removed:', nextDir)
} catch (e) {
  console.error('[clean-next]', e.message)
  process.exit(1)
}

try {
  if (fs.existsSync(nodeModulesCache)) {
    fs.rmSync(nodeModulesCache, { recursive: true, force: true })
    console.log('[clean-next] removed:', nodeModulesCache)
  }
} catch (e) {
  console.warn('[clean-next] node_modules/.cache 제거 실패(무시 가능):', e.message)
}

console.log(
  '[clean-next] 다음: npm run dev:clean 권장(깨끗한 .next 로 next dev -p 3000 시작). 로컬 origin은 http://localhost:3000 고정 — 3000 포트를 다른 node가 쓰면 종료 후 다시 실행하세요.'
)
