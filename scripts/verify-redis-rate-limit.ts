import { getRateLimitStore } from '@/lib/rate-limit-store'

async function run() {
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
  console.log(`OK: rate-limit store kind=${store.kind}, first=${first.count}, second=${second.count}`)
}

run()
