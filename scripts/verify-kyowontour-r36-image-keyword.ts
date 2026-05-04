/**
 * R-3.6: 교원이지 imageKeyword — 다낭&호이안 5일 유형 폴백 삼단 형식.
 * 실행: npx tsx scripts/verify-kyowontour-r36-image-keyword.ts
 */
import assert from 'node:assert/strict'
import { isKyowontourPexelsTooGeneric, polishKyowontourImageKeyword } from '../lib/kyowontour-schedule-image-keyword'

const blob = `AVP190260505VJ01 다낭 호이안`.slice(0, 500)

{
  const kw = polishKyowontourImageKeyword('Da Nang', {
    day: 1,
    title: '1일차',
    description: '다낭 도착 및 시내 관광 (APEC 공원, 사랑의 부두)',
    blob,
  })
  assert.ok(kw.includes('/'), 'day1 triple')
  assert.ok(/APEC|Han\s*River/i.test(kw), 'day1 APEC or river')
}

{
  const kw = polishKyowontourImageKeyword('Hoi An', {
    day: 2,
    title: '2일차',
    description: '미케비치, 마블마운틴, 호이안 올드타운 방문',
    blob,
  })
  assert.ok(kw.includes('/'), 'day2 triple')
  assert.ok(/Hoi\s*An\s+Ancient|lantern/i.test(kw), 'day2 Hoi An old town')
}

{
  const kw = polishKyowontourImageKeyword('', {
    day: 3,
    title: '3일차',
    description: '바나산 골든브릿지 관광',
    blob,
  })
  assert.ok(/Golden\s+Bridge|Ba\s+Na/i.test(kw), 'day3 golden bridge')
}

assert.equal(isKyowontourPexelsTooGeneric('Da Nang'), true)
assert.equal(isKyowontourPexelsTooGeneric('Da Nang APEC Park / Han River / wide'), false)

console.log('verify-kyowontour-r36-image-keyword: ok')
