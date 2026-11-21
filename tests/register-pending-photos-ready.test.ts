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

  it('장소가 있는 날의 빈 사진은 ready 가 아니다', () => {
    const schedule = JSON.stringify([
      { day: 1, imageUrl: 'https://img.example/1.jpg', title: '다낭', routeText: '다낭 - 미케비치' },
      { day: 2, imageUrl: '', title: '호이안', routeText: '호이안 올드타운 - 미케비치' },
    ])
    assert.equal(isRegisterPendingPhotosReady('https://img.example/cover.jpg', schedule), false)
  })

  it('장소 없는 귀국일은 사진이 없어도 ready', () => {
    const schedule = JSON.stringify([
      { day: 1, imageUrl: 'https://img.example/1.jpg', title: '다낭', routeText: '다낭 - 미케비치' },
      { day: 2, imageUrl: '', title: '인천 도착', routeText: '인천공항 도착', hotelText: '숙박 없음' },
    ])
    assert.equal(isRegisterPendingPhotosReady('https://img.example/cover.jpg', schedule), true)
  })
})
