import { getRateLimitStore } from '@/lib/rate-limit-store'

async function run() {
  const r1 = (process.env.REDIS_URL ?? '').trim()
  const r2 = (process.env.BONGTOUR_REDIS_URL ?? '').trim()
  const redisSource = r1 ? 'REDIS_URL' : r2 ? 'BONGTOUR_REDIS_URL' : '(none)'
  console.log(
    '[verify-rate-limit-store] Node 프로세스 기준 — Edge 미들웨어는 별도 격리·항상 memory(kind 표시와 다를 수 있음).'
  )
  console.log(
    `[verify-rate-limit-store] redisEnv=${redisSource} NEXT_RUNTIME=${process.env.NEXT_RUNTIME ?? '(unset, Node script)'}`
  )
  const store = getRateLimitStore()
  const key = `verify:${Date.now()}`
  const first = await store.incr(key, 5000)
  const second = await store.incr(key, 5000)
  if (first.count < 1 || second.count < 2) {
    throw new Error(`rate-limit increment failed: first=${first.count}, second=${second.count}`)
  }
  if (second.resetAt <= Date.now()) {
    throw new Error('rate-limit ttl/resetAt is invalid')
  }
  console.log(`OK: store kind=${store.kind}, first=${first.count}, second=${second.count}`)
}

run()
