/**
 * node-cron: 매일 05:00 가격 동기화, 15분마다 최근 1시간 상품 이미지 생성.
 * 실행: npx tsx scripts/scheduler.ts  (프로세스를 유지해야 함)
 * Next.js 서버가 떠 있어야 process-images/recent 호출 가능 (같은 호스트에서)
 */
import cron from 'node-cron'
import { runSync } from './sync-prices'

const CRON_SYNC = process.env.CRON_SYNC_SCHEDULE || '0 5 * * *' // 매일 05:00
const CRON_IMAGES = process.env.CRON_IMAGES_SCHEDULE || '*/15 * * * *' // 15분마다
const API_BASE = process.env.BONGTOUR_API_BASE || 'http://localhost:3000'

cron.schedule(CRON_SYNC, () => {
  console.log('[cron] Running sync at', new Date().toISOString())
  runSync().catch((e) => console.error('[cron] Sync error', e))
})

cron.schedule(CRON_IMAGES, () => {
  const url = `${API_BASE.replace(/\/$/, '')}/api/admin/process-images/recent`
  console.log('[cron] Process images (recent 1h) at', new Date().toISOString())
  fetch(url, { method: 'GET' })
    .then((r) => r.text())
    .then((t) => {
      try {
        const d = t ? JSON.parse(t) : {}
        if (d.processed > 0) console.log('[cron] Images processed:', d.processed)
      } catch {
        // ignore
      }
    })
    .catch((e) => console.error('[cron] Process images error', e))
})

console.log('[cron] Sync:', CRON_SYNC, '| Images (recent 1h):', CRON_IMAGES)
