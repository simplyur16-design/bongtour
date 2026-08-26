/**
 * REGRESSION-FREEZE[pending-approve-photos-ready]: 사진 전 registered 금지 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isRegisterPendingPhotosReady } from '../lib/register-pending-photos-ready'

describe('pending-approve-photos-ready', () => {
  it('커버와 일정 일차 이미지가 있으면 ready', () => {
    const schedule = JSON.stringify([
      { day: 1, imageUrl: 'https://img.example/1.jpg' },
      { day: 2, imageUrl: 'https://img.example/2.jpg' },
    ])
    assert.equal(isRegisterPendingPhotosReady('https://img.example/cover.jpg', schedule), true)
  })

  it('커버가 없으면 ready 가 아니다', () => {
    const schedule = JSON.stringify([{ day: 1, imageUrl: 'https://img.example/1.jpg' }])
    assert.equal(isRegisterPendingPhotosReady('', schedule), false)
    assert.equal(isRegisterPendingPhotosReady(null, schedule), false)
  })

  it('일정 일차 이미지가 비면 ready 가 아니다', () => {
    const schedule = JSON.stringify([
      { day: 1, imageUrl: 'https://img.example/1.jpg' },
      { day: 2, imageUrl: '' },
    ])
    assert.equal(isRegisterPendingPhotosReady('https://img.example/cover.jpg', schedule), false)
  })
})
