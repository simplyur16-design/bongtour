import { describe, expect, it } from 'vitest'
import {
  ESIM_QR_NOTIFY_TOPIC,
  computeEsimQrNotifyStaggerMs,
  esimQrNotifyDedupeKey,
} from '@/lib/bongsim/fulfillment/esim-qr-notify-outbox'

// REGRESSION-FREEZE[bongsim-esim-qr-notify-serialize]: stagger helpers — manifest

describe('esim-qr-notify-outbox', () => {
  it('topic and dedupe key — per topup for qty>1', () => {
    expect(ESIM_QR_NOTIFY_TOPIC).toBe('EsimQrNotify')
    expect(esimQrNotifyDedupeKey('abc')).toBe('bongsim:esim_qr_notify:abc')
    expect(esimQrNotifyDedupeKey('abc', 't1')).toBe('bongsim:esim_qr_notify:abc:t1')
    expect(esimQrNotifyDedupeKey('abc', 't1')).not.toBe(esimQrNotifyDedupeKey('abc', 't2'))
  })

  it('stagger grows with pending count (prevents Solapi burst)', () => {
    expect(computeEsimQrNotifyStaggerMs(0, 1200)).toBe(0)
    expect(computeEsimQrNotifyStaggerMs(1, 1200)).toBe(1200)
    expect(computeEsimQrNotifyStaggerMs(4, 1200)).toBe(4800)
    expect(computeEsimQrNotifyStaggerMs(9, 1200)).toBe(10_800)
  })
})
