/**
 * REGRESSION-FREEZE[register-keyword-city-qualified-landmark]: City Mosque·Pink Mosque 단독 금지, 첫날 관광 키워드 필수 — manifest
 * 실행: npx tsx scripts/verify-register-keyword-city-qualified.ts
 */
import assert from 'node:assert/strict'
import {
  finalizeScheduleImageKeyword,
  isGenericAnyCityLandmarkKeyword,
  normalizeToPlaceName,
} from '../lib/pexels-place-name-keyword'
import { isBrokenRegisterLandmarkKeyword } from '../lib/register-pre-photo-guards'
import {
  healRegisterPrePhotoSchedule,
} from '../lib/register-pre-photo-self-heal'
import { verifyRegisterPrePhoto } from '../lib/register-pre-photo-verify'

assert.equal(isGenericAnyCityLandmarkKeyword('City Mosque'), true)
assert.equal(isGenericAnyCityLandmarkKeyword('PINK MOSQUE'), true)
assert.equal(isGenericAnyCityLandmarkKeyword('Blue Mosque'), true)
assert.equal(isGenericAnyCityLandmarkKeyword('City Mosque Kota Kinabalu'), false)
assert.equal(isGenericAnyCityLandmarkKeyword('Pink Mosque Kota Kinabalu'), false)
assert.equal(isGenericAnyCityLandmarkKeyword('Kota Kinabalu City Mosque'), false)
assert.equal(isGenericAnyCityLandmarkKeyword('Blue Mosque Istanbul'), false)

assert.equal(isBrokenRegisterLandmarkKeyword('City Mosque'), true)
assert.equal(isBrokenRegisterLandmarkKeyword('Pink Mosque'), true)
assert.equal(isBrokenRegisterLandmarkKeyword('City Mosque Kota Kinabalu'), false)
assert.equal(isBrokenRegisterLandmarkKeyword('Pink Mosque Kota Kinabalu'), false)
assert.equal(isBrokenRegisterLandmarkKeyword('Kota Kinabalu City Mosque'), false)

assert.equal(normalizeToPlaceName('Pink Mosque Kota Kinabalu'), 'Pink Mosque Kota Kinabalu')
assert.equal(normalizeToPlaceName('City Mosque Kota Kinabalu'), 'City Mosque Kota Kinabalu')
assert.equal(normalizeToPlaceName('Blue Mosque Istanbul'), 'Blue Mosque Istanbul')
assert.equal(normalizeToPlaceName('City Mosque'), '')
assert.equal(normalizeToPlaceName('Pink Mosque'), '')
assert.equal(finalizeScheduleImageKeyword('Pink Mosque Kota Kinabalu'), 'Pink Mosque Kota Kinabalu')
assert.equal(finalizeScheduleImageKeyword('Kota Kinabalu City Mosque'), 'Kota Kinabalu City Mosque')

const rows = [
  {
    day: 1,
    title: '1일차',
    description: '코타키나발루에 도착해 시티 모스크를 둘러봅니다. 수변 사원 주변을 이어서 봅니다.',
    routeText: '코타키나발루 시티모스크 - 핑크모스크',
    imageKeyword: '',
  },
  {
    day: 2,
    title: '2일차',
    description: '키나발루 산 주변을 둘러봅니다. 산릉과 호수 구간을 천천히 이어갑니다.',
    routeText: '키나발루산',
    imageKeyword: 'Mount Kinabalu',
  },
  {
    day: 3,
    title: '귀국',
    description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.',
    routeText: '인천',
    imageKeyword: '',
  },
]

const emptyDay1 = verifyRegisterPrePhoto({
  lane: 'package',
  productTitle: '코타키나발루 3일',
  productDestination: '코타키나발루',
  rows,
})
assert.ok(emptyDay1.issues.includes('day1_departure_keyword_empty'), String(emptyDay1.issues))

const genericDay1 = verifyRegisterPrePhoto({
  lane: 'package',
  productTitle: '코타키나발루 3일',
  productDestination: '코타키나발루',
  rows: [{ ...rows[0]!, imageKeyword: 'City Mosque' }, rows[1]!, rows[2]!],
})
assert.ok(
  genericDay1.issues.includes('day1_keyword_lodging_or_non_landmark'),
  String(genericDay1.issues),
)

const healed = healRegisterPrePhotoSchedule(rows, {
  supplierKey: 'hanatour',
  productDestination: '코타키나발루',
  productTitle: '코타키나발루 3일',
})
const day1 = String(healed.rows.find((r) => r.day === 1)?.imageKeyword ?? '')
assert.match(day1, /Kota Kinabalu|Pink Mosque Kota Kinabalu|City Mosque Kota Kinabalu/i)
assert.doesNotMatch(day1, /^(?:City Mosque|Pink Mosque)$/i)

console.log('verify-register-keyword-city-qualified: ok')
