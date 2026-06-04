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

const rmOpts = { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }

/** Windows ENOTEMPTY 시: 하위 파일부터 수동 삭제 */
function rmDirBottomUp(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name)
    if (entry.isDirectory()) rmDirBottomUp(child)
    else fs.unlinkSync(child)
  }
  fs.rmdirSync(dir)
}

function rmDirSafe(target, { label, fatal = true }) {
  if (!fs.existsSync(target)) return true
  try {
    fs.rmSync(target, rmOpts)
    console.log('[clean-next] removed:', target)
    return true
  } catch (first) {
    const retryable =
      first && typeof first === 'object' && 'code' in first &&
      ['ENOTEMPTY', 'EBUSY', 'EPERM', 'EACCES'].includes(first.code)
    if (retryable) {
      try {
        rmDirBottomUp(target)
        console.log('[clean-next] removed (bottom-up):', target)
        return true
      } catch (second) {
        first = second
      }
    }
    const code = first && typeof first === 'object' && 'code' in first ? first.code : ''
    const msg = `[clean-next] ${label} 제거 실패 (${code || 'error'}): ${first.message}`
    if (fatal) {
      console.error(msg)
      if (code === 'ENOTEMPTY' || code === 'EBUSY' || code === 'EPERM') {
        console.error(
          '[clean-next] Windows: 실행 중인 next dev/node를 종료한 뒤 다시 시도하세요. (포트 3000 점유 프로세스 확인)'
        )
      }
      process.exit(1)
    }
    console.warn(msg)
    return false
  }
}

rmDirSafe(nextDir, { label: '.next', fatal: true })
rmDirSafe(nodeModulesCache, { label: 'node_modules/.cache', fatal: false })

console.log(
  '[clean-next] 다음: npm run dev:clean 권장(깨끗한 .next 로 next dev -p 3000 시작). 로컬 origin은 http://localhost:3000 고정 — 3000 포트를 다른 node가 쓰면 종료 후 다시 실행하세요.'
)
