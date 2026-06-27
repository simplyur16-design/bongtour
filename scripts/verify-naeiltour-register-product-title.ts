/**
 * 내일투어 등록 상품명·항공 추출 가드.
 * REGRESSION-FREEZE[naeiltour-register-product-title]: manifest
 */
import assert from 'node:assert/strict'
import { normalizeNaeiltourRegisterListingTitle } from '@/lib/naeiltour-register-product-title'
import { buildNaeiltourFlightStructuredFromHtml } from '@/lib/naeiltour-register-api-detail'

assert.equal(normalizeNaeiltourRegisterListingTitle('싱가폴 마리나베이샌즈 금까기'), '싱가폴 마리나베이샌즈')
assert.equal(normalizeNaeiltourRegisterListingTitle('진짜 유럽 9일'), '유럽 9일')
assert.equal(normalizeNaeiltourRegisterListingTitle('프랑크푸르트 진짜 금까기'), '프랑크푸르트')

const airtelHay = `
<div class="airline"><p class="btxt">항공사</p><p class="stxt">싱가폴항공</p></div>
<p class="stxt"><strong>2026년 06월 30일(화)</strong>[11:05~16:35] - SQ611</p>
<p class="stxt"><strong>2026년 07월 04일(토)</strong>[02:30~09:50] - SQ612</p>
`
const fs = buildNaeiltourFlightStructuredFromHtml(airtelHay, null, null)
assert.ok(fs, 'airtel sample flight structured')
assert.match(fs!.airlineName ?? '', /싱가폴/)
assert.equal(fs!.outbound?.flightNo, 'SQ611')
assert.equal(fs!.inbound?.flightNo, 'SQ612')
assert.equal(fs!.outbound?.departureTime, '11:05')
assert.equal(fs!.inbound?.departureTime, '02:30')

console.log('verify-naeiltour-register-product-title: ok')
