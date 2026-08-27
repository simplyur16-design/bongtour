/**
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 나라만 1 · 도시별 1 · 패키지+자유여행 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: rotate slots per supplier — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  extractYbtourListingEvCds,
  buildYbtourLocalListUrl,
  parseYbtourDspSidFromUrl,
  ybtourListingMenuFromUrl,
} from '../lib/register-listing-discover-ybtour'
import { extractHanatourListingPkgCds, buildHanatourDetailUrl } from '../lib/register-listing-discover-hanatour'
import { extractModetourListingProductNos } from '../lib/register-listing-discover-modetour'
import { extractVerygoodtourListingProCodes } from '../lib/register-listing-discover-verygoodtour'
import { extractRegisterProductDedupeKeys } from '../lib/register-product-duplicate-guard'
import {
  REGISTER_PRE_PHOTO_INGEST_PER_GEO,
  REGISTER_PRE_PHOTO_INGEST_LANES,
  REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN,
  buildRegisterPrePhotoIngestGeoSlots,
  listingUrlMatchesIngestLane,
  rotateRegisterPrePhotoIngestSlots,
  travelScopeForIngestLane,
  ybtourListingMenuForIngestLane,
  type RegisterPrePhotoIngestProductRow,
} from '../lib/register-pre-photo-ingest-geo-slots'

function row(partial: Partial<RegisterPrePhotoIngestProductRow> & { originSource: string; originUrl: string; countryKey: string }): RegisterPrePhotoIngestProductRow {
  return {
    originUrl: partial.originUrl,
    originSource: partial.originSource,
    countryKey: partial.countryKey,
    cityKey: partial.cityKey ?? null,
    destination: partial.destination ?? null,
    registrationStatus: partial.registrationStatus ?? 'registered',
    listingKind: partial.listingKind ?? 'travel',
    productType: partial.productType ?? 'travel',
    sportsThemeTag: partial.sportsThemeTag ?? [],
  }
}

describe('register-pre-photo-listing-ingest', () => {
  it('슬롯당 1건이고 3건·공급사당 하루 3 URL이 아니다', () => {
    assert.equal(REGISTER_PRE_PHOTO_INGEST_PER_GEO, 1)
    assert.deepEqual([...REGISTER_PRE_PHOTO_INGEST_LANES], ['package', 'air_hotel_free'])
  })

  it('나라만 있으면 나라 1개, 패키지와 자유여행을 각각 붙인다', () => {
    const slots = buildRegisterPrePhotoIngestGeoSlots([
      row({
        originSource: 'ybtour',
        originUrl: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAB001&evCd=AVP4484-260711RS00',
        countryKey: 'france',
        destination: '프랑스',
      }),
    ])
    assert.equal(slots.length, 2)
    assert.equal(slots.every((s) => s.countryKey === 'france' && s.cityKey == null), true)
    assert.equal(slots.some((s) => s.lane === 'package'), true)
    assert.equal(slots.some((s) => s.lane === 'air_hotel_free'), true)
    assert.equal(travelScopeForIngestLane('package'), 'overseas')
    assert.equal(travelScopeForIngestLane('air_hotel_free'), 'air_hotel_free')
  })

  it('나라 안에 도시가 있으면 도시별 1개이고 나라 슬롯은 없다', () => {
    const slots = buildRegisterPrePhotoIngestGeoSlots([
      row({
        originSource: 'hanatour',
        originUrl: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EEP133260701KEY',
        countryKey: 'spain',
        cityKey: 'barcelona',
        destination: '바르셀로나',
      }),
      row({
        originSource: 'hanatour',
        originUrl: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=JMB331260701BXF',
        countryKey: 'spain',
        cityKey: 'madrid',
        destination: '마드리드',
      }),
      row({
        originSource: 'hanatour',
        originUrl: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CHP101260701TWW',
        countryKey: 'spain',
        cityKey: null,
        destination: '스페인',
      }),
    ])
    const geos = [...new Set(slots.map((s) => `${s.countryKey}::${s.cityKey ?? ''}`))]
    assert.deepEqual(geos.sort(), ['spain::barcelona', 'spain::madrid'])
    assert.equal(slots.filter((s) => s.lane === 'package').length, 2)
    assert.equal(slots.filter((s) => s.lane === 'air_hotel_free').length, 2)
  })

  it('대기 pending 은 레인별로만 센다', () => {
    const slots = buildRegisterPrePhotoIngestGeoSlots([
      row({
        originSource: 'modetour',
        originUrl: 'https://www.modetour.com/package/111617319',
        countryKey: 'japan',
        cityKey: 'osaka',
        destination: '오사카',
        registrationStatus: 'pending',
        listingKind: 'travel',
      }),
      row({
        originSource: 'modetour',
        originUrl: 'https://www.modetour.com/package/103887821',
        countryKey: 'japan',
        cityKey: 'osaka',
        destination: '오사카',
        listingKind: 'air_hotel_free',
        productType: 'air-hotel',
      }),
    ])
    const pkg = slots.find((s) => s.lane === 'package')
    const fit = slots.find((s) => s.lane === 'air_hotel_free')
    assert.equal(pkg?.pending, 1)
    assert.equal(fit?.pending, 0)
  })

  it('ybtour 자유여행 레인은 FIT 메뉴다', () => {
    assert.equal(ybtourListingMenuForIngestLane('package'), 'PKG')
    assert.equal(ybtourListingMenuForIngestLane('air_hotel_free'), 'FIT')
    assert.equal(
      listingUrlMatchesIngestLane(
        'ybtour',
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABIB001&evCd=CIF1003-260707OZ00',
        'air_hotel_free',
      ),
      true,
    )
    assert.equal(
      listingUrlMatchesIngestLane(
        'ybtour',
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAB001&evCd=AVP4484-260711RS00',
        'air_hotel_free',
      ),
      false,
    )
  })

  it('ybtour localList evCd 와 FIT 메뉴를 읽는다', () => {
    assert.equal(
      parseYbtourDspSidFromUrl(
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAB001&evCd=AVP4484-260711RS00',
      ),
      'AAAB001',
    )
    assert.equal(
      ybtourListingMenuFromUrl(
        'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABIB001&evCd=CIF1003-260707OZ00',
      ),
      'FIT',
    )
    assert.equal(buildYbtourLocalListUrl('AAAB000', 'PKG').includes('localList'), true)
    const evCds = extractYbtourListingEvCds(
      '<a href="/product/detailPackage?menu=PKG&evCd=AVP4484-260711RS00">x</a>{"evCd":"EEP1284-260703LO01"}',
    )
    assert.ok(evCds.includes('AVP4484-260711RS00'))
    assert.ok(evCds.includes('EEP1284-260703LO01'))
  })

  it('hanatour·modetour·verygoodtour 목록 HTML에서 상세 코드를 뽑는다', () => {
    const pkg = extractHanatourListingPkgCds(
      'href="?pkgCd=EEP133260701KEY&prePage=major-products" "saleProdCd":"JMB331260701BXF"',
    )
    assert.ok(pkg.includes('EEP133260701KEY'))
    assert.ok(pkg.includes('JMB331260701BXF'))
    assert.equal(buildHanatourDetailUrl('EEP133260701KEY').includes('pkgCd=EEP133260701KEY'), true)

    const nos = extractModetourListingProductNos(
      '<a href="https://www.modetour.com/package/111617319">x</a>{"productNo":103887821}',
    )
    assert.ok(nos.includes('111617319'))
    assert.ok(nos.includes('103887821'))

    const codes = extractVerygoodtourListingProCodes(
      '?ProCode=CPP7272-260708TW5&x=1 "proCode":"APP2586-2606239G35"',
    )
    assert.ok(codes.includes('CPP7272-260708TW5'))
    assert.ok(codes.includes('APP2586-2606239G35'))
  })

  it('이미 있는 originUrl 은 중복 키로 걸린다', () => {
    const url = 'https://www.modetour.com/package/111617319'
    const keys = extractRegisterProductDedupeKeys('modetour', url)
    const known = new Set(keys.map((k) => `${k.kind}:${k.value}`))
    const again = extractRegisterProductDedupeKeys('modetour', url)
    assert.equal(again.some((k) => known.has(`${k.kind}:${k.value}`)), true)
  })

  it('하루 공급사당 Playwright 목록 슬롯을 날짜로 돌려 자른다', () => {
    assert.equal(REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN, 4)
    const slots = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = rotateRegisterPrePhotoIngestSlots(slots, '2026-08-27::hanatour', 4)
    const b = rotateRegisterPrePhotoIngestSlots(slots, '2026-08-28::hanatour', 4)
    assert.equal(a.length, 4)
    assert.equal(b.length, 4)
    assert.deepEqual(rotateRegisterPrePhotoIngestSlots(slots, '2026-08-27::hanatour', 8), slots)
    assert.deepEqual(rotateRegisterPrePhotoIngestSlots([], '2026-08-27', 4), [])
  })

  it('Windows cp949 stdin 이 한글 searchWord 를 깨지 않게 UTF-8 바이트로 넘긴다', () => {
    const spawnSrc = readFileSync(new URL('../lib/register-listing-discover-spawn.ts', import.meta.url), 'utf8')
    assert.match(spawnSrc, /PYTHONUTF8/)
    assert.match(spawnSrc, /Buffer\.from\(payload, 'utf8'\)/)
    for (const rel of [
      '../scripts/listing_discover_hanatour/main.py',
      '../scripts/listing_discover_modetour/main.py',
      '../scripts/listing_discover_ybtour/main.py',
      '../scripts/listing_discover_verygoodtour/main.py',
    ]) {
      const py = readFileSync(new URL(rel, import.meta.url), 'utf8')
      assert.match(py, /stdin\.buffer\.read\(\)/)
    }
  })

  it('신규등록 ingest 는 매일 KST 06:30 이다', () => {
    const cron = readFileSync(
      new URL('../lib/instrumentation-register-pre-photo-self-heal-cron.ts', import.meta.url),
      'utf8',
    )
    assert.match(cron, /'30 6 \* \* \*'/)
    assert.match(cron, /Asia\/Seoul/)
    assert.match(cron, /runRegisterPrePhotoDailyJob/)
  })
})
