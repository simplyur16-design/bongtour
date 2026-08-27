import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getRegisterIngestApiOrigin, isLoopbackHttpOrigin } from '../lib/register-ingest-api-origin'
import { productRowIsLiveRegisterPendingQueue } from '../lib/register-pre-photo-pending-queue-query'
import { isRegisterPrePhotoPendingQueueReady } from '../lib/register-pre-photo-pending-queue'

// REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 워커 origin·라이브 큐 — manifest

describe('register-ingest-api-origin', () => {
  it('treats localhost as loopback', () => {
    assert.equal(isLoopbackHttpOrigin('http://localhost:3000'), true)
    assert.equal(isLoopbackHttpOrigin('https://bongtour.com'), false)
  })

  it('production never falls back to localhost when public URL is missing', () => {
    assert.equal(
      getRegisterIngestApiOrigin({ NODE_ENV: 'production' }),
      'https://bongtour.com',
    )
    assert.equal(
      getRegisterIngestApiOrigin({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      }),
      'https://bongtour.com',
    )
  })

  it('prefers explicit public REGISTER_INGEST_API_ORIGIN', () => {
    assert.equal(
      getRegisterIngestApiOrigin({
        NODE_ENV: 'production',
        REGISTER_INGEST_API_ORIGIN: 'https://bongtour.com',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      }),
      'https://bongtour.com',
    )
  })
})

describe('live register pending queue row', () => {
  it('rejects rows that fail pre-photo verify even if DB status would be pending', () => {
    assert.equal(isRegisterPrePhotoPendingQueueReady({ ok: false }), false)
    assert.equal(
      productRowIsLiveRegisterPendingQueue({
        listingKind: 'travel',
        productType: 'travel',
        sportsThemeTag: [],
        schedule: JSON.stringify([{ day: 1, description: '', imageKeyword: '' }]),
      }),
      false,
    )
  })
})
