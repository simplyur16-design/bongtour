/**
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 검색 시드 geo · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: KST 22:00–10:00 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: rotate slots per supplier — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 검증 통과만 등록대기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-keep-looking-until-quota]: 있는 URL 스킵 후 다음 목록 — manifest
 * REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: 시드 상세를 목록으로 쓰지 않음 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: 사람처럼 한 세션 · bundled Chromium — manifest
 * REGRESSION-FREEZE[register-hanatour-listing-package-first]: 짧은 검색어 · 시드 pkgCd 제외 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-search-not-404]: 홈 검색함 · 404 목록 URL 금지 — manifest
 * REGRESSION-FREEZE[register-listing-discover-overseas-click]: 메가메뉴 나라·도시만 클릭 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: canonical 7사 동일 클릭·검증 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-pkg-fit-theme-kind]: pkg·FIT 교차 · 테마 태그 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-naeiltour-fit-first]: naeiltour 자유여행 우선 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-night-leftover-not-quota]: leftover pending ≠ 오늘 할당량 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-dismiss]: 홈 팝업 닫고 해외여행 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-mega-menu]: 사이트 메뉴 글자만 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-calendar-product]: 나라→출발일→달력 아래 상품 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-detail-schedule]: 달력 아래 목록의 상세일정 클릭 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-list-depart-calendar]: 나라 목록 상품 출발일→달력→상세일정 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-menu-navigate]: 나라 클릭 후 목록으로 나감 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-not-card-close]: 팝업만 닫고 출발일 닫기는 안 누름 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-listing-menucode]: 클릭 URL 빈 menuCode는 목록 값 — manifest
 * REGRESSION-FREEZE[register-listing-discover-kyowontour-popup-x]: 팝업은 ×만 닫기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 패키지 노옵션·노쇼핑 우선 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-prisma-retry]: 힐 저장 재시도 · ingest 후 200건 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extractYbtourListingEvCds,
  buildYbtourLocalListUrl,
  parseYbtourDspSidFromUrl,
  ybtourListingMenuFromUrl,
} from '../lib/register-listing-discover-ybtour'
import {
  extractHanatourListingPkgCds,
  buildHanatourDetailUrl,
  hanatourListingSearchWord,
  dropHanatourSeedPkgCd,
} from '../lib/register-listing-discover-hanatour'
import { megaMenuClickLabelForIngestSlot } from '../lib/mega-menu-click-label'
import { extractModetourListingProductNos } from '../lib/register-listing-discover-modetour'
import { extractVerygoodtourListingProCodes } from '../lib/register-listing-discover-verygoodtour'
import { extractRegisterProductDedupeKeys } from '../lib/register-product-duplicate-guard'
import {
  REGISTER_PRE_PHOTO_INGEST_PER_GEO,
  REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
  REGISTER_PRE_PHOTO_INGEST_LANES,
  REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN,
  buildRegisterPrePhotoIngestGeoSlots,
  parseRegisterPrePhotoIngestOnlySuppliers,
  pickUnknownListingUrlsUntilQuota,
  listingUrlMatchesIngestLane,
  rotateRegisterPrePhotoIngestSlots,
  travelScopeForIngestLane,
  interleaveRegisterPrePhotoIngestLanes,
  orderRegisterPrePhotoIngestSlotsForSupplier,
  ybtourListingMenuForIngestLane,
  REGISTER_PRE_PHOTO_INGEST_SUPPLIERS,
  ingestSupplierBrowseHome,
  type RegisterPrePhotoIngestProductRow,
} from '../lib/register-pre-photo-ingest-geo-slots'
import { extractKyowontourListingTourCodes } from '../lib/register-listing-discover-kyowontour'
import { extractLottetourListingDetailUrls } from '../lib/register-listing-discover-lottetour'
import { extractNaeiltourListingGoodCds } from '../lib/register-listing-discover-naeiltour'
import {
  listingHaystackIsNoOptionNoShopping,
  listingHaystackNoOptionNoShoppingScore,
  orderListingUrlsPreferNoOptionNoShopping,
} from '../lib/register-pre-photo-ingest-no-option-no-shopping'
import {
  REGISTER_PRE_PHOTO_BLOCKED_STATUS,
  isRegisterPrePhotoPendingQueueReady,
  occupiesRegisterPrePhotoIngestSlot,
  registrationStatusAfterPrePhotoVerify,
  isRegisterPrePhotoKeywordPhotoGateStatus,
} from '../lib/register-pre-photo-pending-queue'

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
  it('이미 등록된 URL은 건너뛰고 공급사마다 하루 3건이다', () => {
    assert.equal(REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER, 3)
    assert.equal(REGISTER_PRE_PHOTO_INGEST_PER_GEO, 1)
    assert.deepEqual([...REGISTER_PRE_PHOTO_INGEST_LANES], ['package', 'air_hotel_free'])
    assert.deepEqual(parseRegisterPrePhotoIngestOnlySuppliers('modetour,verygoodtour,ybtour'), [
      'modetour',
      'verygoodtour',
      'ybtour',
    ])
    assert.equal(parseRegisterPrePhotoIngestOnlySuppliers(''), null)
    assert.deepEqual([...REGISTER_PRE_PHOTO_INGEST_SUPPLIERS], [
      'hanatour',
      'modetour',
      'ybtour',
      'verygoodtour',
      'kyowontour',
      'lottetour',
      'naeiltour',
    ])
  })

  it('등록대기 leftover가 있어도 모르는 URL은 오늘 3건까지 받는다', () => {
    const leftoverQueuePending = 12
    void leftoverQueuePending
    const known = new Set(['https://known.example/a'])
    const got = pickUnknownListingUrlsUntilQuota(
      [['https://known.example/a', 'https://new.example/1', 'https://new.example/2', 'https://new.example/3']],
      (url) => known.has(url),
      REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
    )
    assert.deepEqual(got, ['https://new.example/1', 'https://new.example/2', 'https://new.example/3'])
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
    const yb = slots.filter((s) => s.supplier === 'ybtour')
    assert.equal(yb.length, 2)
    assert.equal(yb.every((s) => s.countryKey === 'france' && s.cityKey == null), true)
    assert.equal(yb.some((s) => s.lane === 'package'), true)
    assert.equal(yb.some((s) => s.lane === 'air_hotel_free'), true)
    assert.equal(new Set(slots.map((s) => s.supplier)).size, 7)
    assert.equal(slots.find((s) => s.supplier === 'kyowontour')?.originUrl, ingestSupplierBrowseHome('kyowontour'))
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
    const hanatour = slots.filter((s) => s.supplier === 'hanatour')
    const geos = [...new Set(hanatour.map((s) => `${s.countryKey}::${s.cityKey ?? ''}`))]
    assert.deepEqual(geos.sort(), ['spain::barcelona', 'spain::madrid'])
    assert.equal(hanatour.filter((s) => s.lane === 'package').length, 2)
    assert.equal(hanatour.filter((s) => s.lane === 'air_hotel_free').length, 2)
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
    const pkg = slots.find((s) => s.supplier === 'modetour' && s.lane === 'package')
    const fit = slots.find((s) => s.supplier === 'modetour' && s.lane === 'air_hotel_free')
    assert.equal(pkg?.pending, 1)
    assert.equal(fit?.pending, 0)
  })

  it('hanatour 목록 URL은 pkgCd·type=H01 로 패키지/자유여행을 가른다', () => {
    assert.equal(
      listingUrlMatchesIngestLane(
        'hanatour',
        'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CMB1952607057CH',
        'air_hotel_free',
      ),
      true,
    )
    assert.equal(
      listingUrlMatchesIngestLane(
        'hanatour',
        'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CMB1952607057CH',
        'package',
      ),
      false,
    )
    assert.equal(
      listingUrlMatchesIngestLane(
        'hanatour',
        'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CHP101260701TWW',
        'package',
      ),
      true,
    )
    assert.equal(
      listingUrlMatchesIngestLane(
        'hanatour',
        'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EEP133260701KEY&type=H01',
        'air_hotel_free',
      ),
      true,
    )
  })

  it('패키지와 자유여행 슬롯을 교차해 자유여행 메뉴를 빠뜨리지 않는다', () => {
    assert.deepEqual(interleaveRegisterPrePhotoIngestLanes(['p1', 'p2', 'p3'], ['f1']), [
      'p1',
      'f1',
      'p2',
      'p3',
    ])
  })

  it('내일투어는 자유여행 슬롯을 패키지보다 먼저 본다', () => {
    assert.deepEqual(orderRegisterPrePhotoIngestSlotsForSupplier('naeiltour', ['p1', 'p2'], ['f1', 'f2']), [
      'f1',
      'f2',
      'p1',
      'p2',
    ])
    assert.deepEqual(orderRegisterPrePhotoIngestSlotsForSupplier('modetour', ['p1'], ['f1']), ['p1', 'f1'])
  })

  it('교원투어는 사이트 메가메뉴 글자만 고른다', () => {
    const menu = readFileSync(new URL('../scripts/listing_discover_kyowontour/menu_label.py', import.meta.url), 'utf8')
    assert.match(menu, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-mega-menu\]/)
    assert.match(menu, /pick_kyowontour_mega_menu_label/)
    const root = process.cwd()
    const venvPy = resolve(root, '.venv', 'Scripts', 'python.exe')
    const py = existsSync(venvPy) ? venvPy : 'python'
    const out = execFileSync(
      py,
      [
        '-c',
        'from scripts.listing_discover_kyowontour.menu_label import pick_kyowontour_mega_menu_label as p\n'
        + 'assert p("괌", ["괌/사이판", "일본"]) == "괌/사이판"\n'
        + 'assert p("마츠야마", ["마쓰야마"]) == "마쓰야마"\n'
        + 'assert p("괌", ["해외여행"]) == ""\n'
        + 'print("ok")',
      ],
      { cwd: root, env: { ...process.env, PYTHONPATH: root }, encoding: 'utf8' },
    )
    assert.match(out, /ok/)
  })

  it('내일투어 목록은 메뉴가 없으면 자유여행을 누른다', () => {
    const py = readFileSync(new URL('../scripts/listing_discover_naeiltour/main.py', import.meta.url), 'utf8')
    assert.match(py, /listingMenu"\) or "FIT"/)
    assert.match(py, /_click_label\(page, "자유여행"\)/)
    assert.equal(py.includes('listingMenu") or "PKG"'), false)
    const ts = readFileSync(new URL('../lib/register-listing-discover-naeiltour.ts', import.meta.url), 'utf8')
    assert.match(ts, /listingMenu\?: 'PKG' \| 'FIT'/)
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

    const tours = extractKyowontourListingTourCodes(
      'href="?tourCode=MCP160260622WS01" "TourCode":"ABC12345678"',
    )
    assert.ok(tours.includes('MCP160260622WS01'))
    const lotte = extractLottetourListingDetailUrls(
      'https://www.lottetour.com/evtDetail/826/854/1005/1746?evtCd=E04A260626KE002',
    )
    assert.ok(lotte.some((u) => u.includes('evtCd=E04A260626KE002')))
    const goods = extractNaeiltourListingGoodCds('href="view.asp?good_cd=MEZZ32069"')
    assert.ok(goods.includes('MEZZ32069'))
  })

  it('이미 있는 originUrl 은 중복 키로 걸린다', () => {
    const url = 'https://www.modetour.com/package/111617319'
    const keys = extractRegisterProductDedupeKeys('modetour', url)
    const known = new Set(keys.map((k) => `${k.kind}:${k.value}`))
    const again = extractRegisterProductDedupeKeys('modetour', url)
    assert.equal(again.some((k) => known.has(`${k.kind}:${k.value}`)), true)
  })

  it('하루 공급사당 Playwright 목록 슬롯을 날짜로 돌려 시작점을 옮긴다', () => {
    assert.equal(REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN, 24)
    const slots = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = rotateRegisterPrePhotoIngestSlots(slots, '2026-08-27::hanatour', 4)
    const b = rotateRegisterPrePhotoIngestSlots(slots, '2026-08-28::hanatour', 4)
    assert.equal(a.length, 4)
    assert.equal(b.length, 4)
    const all = rotateRegisterPrePhotoIngestSlots(slots, '2026-08-27::hanatour', 8)
    assert.equal(all.length, 8)
    assert.deepEqual([...all].sort((x, y) => x - y), slots)
    assert.deepEqual(rotateRegisterPrePhotoIngestSlots([], '2026-08-27', 4), [])
  })

  it('첫 목록이 전부 이미 있으면 다음 목록에서 없는 상품을 고른다', () => {
    const known = new Set(['https://known.example/a', 'https://known.example/b'])
    const picked = pickUnknownListingUrlsUntilQuota(
      [
        ['https://known.example/a', 'https://known.example/b'],
        ['https://known.example/a', 'https://new.example/c'],
      ],
      (url) => known.has(url),
      3,
    )
    assert.deepEqual(picked, ['https://new.example/c'])
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
      '../scripts/listing_discover_kyowontour/main.py',
      '../scripts/listing_discover_lottetour/main.py',
      '../scripts/listing_discover_naeiltour/main.py',
    ]) {
      const py = readFileSync(new URL(rel, import.meta.url), 'utf8')
      assert.match(py, /stdin\.buffer\.read\(\)/)
      if (rel.includes('hanatour') || rel.includes('modetour')) {
        assert.match(py, /listingMenu/)
      }
    }
  })

  it('신규등록 ingest 는 KST 22:00–10:00 창에서 날짜마다 다른 시각이다', () => {
    const cron = readFileSync(
      new URL('../lib/instrumentation-register-pre-photo-self-heal-cron.ts', import.meta.url),
      'utf8',
    )
    assert.ok(cron.includes('* 22-23 * * *'))
    assert.ok(cron.includes('* 0-9 * * *'))
    assert.equal(cron.includes("'30 6 * * *'"), false)
    assert.match(cron, /Asia\/Seoul/)
    assert.match(cron, /runRegisterPrePhotoDailyJob/)
    assert.match(cron, /shouldRunRegisterPrePhotoIngestNightTick/)
    const ingestSrc = readFileSync(new URL('../lib/register-pre-photo-listing-ingest.ts', import.meta.url), 'utf8')
    assert.match(ingestSrc, /REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER/)
    assert.match(ingestSrc, /registerPrePhotoListingUrlIsKnown/)
    assert.match(ingestSrc, /listingUrlMapForSupplier\(supplier, sessionSlots\)/)
    assert.match(ingestSrc, /pickUnknownListingUrlsUntilQuota/)
    assert.match(ingestSrc, /Math\.min\(mine\.length, maxListingPages\)/)
    assert.match(ingestSrc, /give-up consecutive discover_throw/)
    assert.equal(ingestSrc.includes('give-up consecutive empty'), false)
    assert.match(ingestSrc, /all-known/)
    assert.match(ingestSrc, /listingPagesPerBrowser/)
    const confirmSrc = readFileSync(new URL('../lib/register-pre-photo-ingest-confirm.ts', import.meta.url), 'utf8')
    assert.match(confirmSrc, /skipRequireAdmin/)
    assert.match(confirmSrc, /postRegisterInProcess/)
    assert.match(confirmSrc, /handleParseAndRegisterKyowontourRequest/)
    assert.match(confirmSrc, /handleParseAndRegisterLottetourRequest/)
    assert.match(confirmSrc, /handleParseAndRegisterNaeiltourRequest/)
    assert.match(confirmSrc, /origin_unsellable/)
    assert.equal(confirmSrc.includes('supplier_route_unsupported'), false)
    assert.equal(confirmSrc.includes('getRegisterIngestApiOrigin'), false)
  })

  it('목록 수집은 사람처럼 한 브라우저 세션이고 설치된 Chrome을 뺏지 않는다', () => {
    const ingestSrc = readFileSync(new URL('../lib/register-pre-photo-listing-ingest.ts', import.meta.url), 'utf8')
    assert.match(ingestSrc, /REGRESSION-FREEZE\[register-listing-discover-human-pace\]/)
    assert.match(ingestSrc, /listingUrlMapForSupplier\(supplier, sessionSlots\)/)
    for (const rel of [
      '../scripts/listing_discover_hanatour/main.py',
      '../scripts/listing_discover_modetour/main.py',
      '../scripts/listing_discover_ybtour/main.py',
      '../scripts/listing_discover_verygoodtour/main.py',
      '../scripts/listing_discover_kyowontour/main.py',
      '../scripts/listing_discover_lottetour/main.py',
      '../scripts/listing_discover_naeiltour/main.py',
    ]) {
      const py = readFileSync(new URL(rel, import.meta.url), 'utf8')
      assert.equal(py.includes('channel="chrome"'), false)
      assert.match(py, /chromium\.launch\(headless=True, args=launch_args\)/)
      assert.match(py, /REGRESSION-FREEZE\[register-listing-discover-human-pace\]/)
      assert.match(py, /_browse_overseas/)
    }
    const ht = readFileSync(new URL('../scripts/listing_discover_hanatour/main.py', import.meta.url), 'utf8')
    assert.match(ht, /PAUSE_MS_MIN = 8000/)
    assert.match(ht, /_browse_overseas/)
    assert.match(ht, /_hover_overseas/)
    const yb = readFileSync(new URL('../scripts/listing_discover_ybtour/main.py', import.meta.url), 'utf8')
    assert.match(yb, /PAUSE_MS_MIN = 7000/)
    assert.match(yb, /parent localList first/)
    assert.match(yb, /goodsCd/)
    const md = readFileSync(new URL('../scripts/listing_discover_modetour/main.py', import.meta.url), 'utf8')
    assert.match(md, /PAUSE_MS_MIN = 11000/)
    const vg = readFileSync(new URL('../scripts/listing_discover_verygoodtour/main.py', import.meta.url), 'utf8')
    assert.match(vg, /PAUSE_MS_MIN = 9000/)
    const kw = readFileSync(new URL('../scripts/listing_discover_kyowontour/main.py', import.meta.url), 'utf8')
    assert.match(kw, /PAUSE_MS_MIN = 10000/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-popup-dismiss\]/)
    assert.match(kw, /오늘하루 보지 않기/)
    assert.match(kw, /get_by_text\("×", exact=True\)/)
    assert.match(kw, /no click \{word\}/)
    assert.equal(kw.includes('_merge(landing'), false)
    assert.match(kw, /_read_mega_menu_labels/)
    assert.match(kw, /pick_kyowontour_mega_menu_label/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-calendar-product\]/)
    assert.match(kw, /_click_listing_calendar_day/)
    assert.match(kw, /menuCode=/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-detail-schedule\]/)
    assert.match(kw, /_click_listing_detail_schedules/)
    assert.match(kw, /상세일정/)
    assert.match(kw, /상세일정보기/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-popup-not-card-close\]/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-listing-menucode\]/)
    assert.match(kw, /_fill_listing_menu_code/)
    assert.match(kw, /출발일/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-list-depart-calendar\]/)
    assert.match(kw, /_browse_country_listing_products/)
    assert.match(kw, /출발일 선택/)
    assert.match(kw, /_click_nth_depart_picker/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-menu-navigate\]/)
    assert.match(kw, /_click_mega_menu_country/)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-popup-x\]/)
    assert.match(kw, /get_by_text\("×", exact=True\)/)
    // REGRESSION-FREEZE[register-listing-discover-kyowontour-expanded-card-click]
    // _click_expanded_card_detail_schedule _close_stale_detail_pages
    // get_by_text("×", exact=True)
    assert.match(kw, /REGRESSION-FREEZE\[register-listing-discover-kyowontour-expanded-card-click\]/)
    assert.match(kw, /_click_expanded_card_detail_schedule/)
    assert.match(kw, /_close_stale_detail_pages/)
    assert.equal(kw.includes('list(range(start, n)) + list(range(0, start))'), false)
    assert.match(kw, /_prefer_listing_no_shop_option_filters/)
    assert.match(kw, /노쇼핑/)
    assert.equal(kw.includes('results.append({"id": sid, "urls": _urls(ids)})'), false)
    const lt = readFileSync(new URL('../scripts/listing_discover_lottetour/main.py', import.meta.url), 'utf8')
    assert.match(lt, /PAUSE_MS_MIN = 13000/)
    const nt = readFileSync(new URL('../scripts/listing_discover_naeiltour/main.py', import.meta.url), 'utf8')
    assert.match(nt, /PAUSE_MS_MIN = 14000/)
  })

  it('목록 수집은 시드 상세 URL을 목록으로 쓰지 않는다', () => {
    const yb = readFileSync(new URL('../scripts/listing_discover_ybtour/main.py', import.meta.url), 'utf8')
    assert.match(yb, /REGRESSION-FREEZE\[register-listing-discover-no-seed-detail\]/)
    assert.match(yb, /localList/)
    assert.equal(yb.includes('if not ids and seed'), false)
    const vg = readFileSync(new URL('../scripts/listing_discover_verygoodtour/main.py', import.meta.url), 'utf8')
    assert.match(vg, /REGRESSION-FREEZE\[register-listing-discover-no-seed-detail\]/)
    assert.match(vg, /_browse_overseas/)
    assert.equal(vg.includes('candidates.append(seed)'), false)
    assert.equal(vg.includes('Product/ProductList'), false)
    const md = readFileSync(new URL('../scripts/listing_discover_modetour/main.py', import.meta.url), 'utf8')
    assert.match(md, /REGRESSION-FREEZE\[register-listing-discover-no-seed-detail\]/)
    assert.equal(md.includes('candidates.append(seed)'), false)
    assert.equal(md.includes('modetour.com/search?keyword='), false)
    assert.match(md, /wait_for\(resp\.text\(\), timeout=4\)/)
    const ht = readFileSync(new URL('../scripts/listing_discover_hanatour/main.py', import.meta.url), 'utf8')
    assert.match(ht, /REGRESSION-FREEZE\[register-listing-discover-no-seed-detail\]/)
    assert.equal(ht.includes('candidates.append(seed)'), false)
    assert.equal(ht.includes('CHPC0PKG0119P200'), false)
    assert.equal(ht.includes('package?keyword='), false)
    assert.match(ht, /_browse_overseas/)
    assert.match(ht, /_short_word/)
    assert.match(ht, /_without_seed/)
  })

  it('hanatour 검색어는 짧은 지명만 쓰고 시드 pkgCd는 목록에서 뺀다', () => {
    assert.equal(hanatourListingSearchWord('인컨타라 사막 · 사막의밤 외'), '인컨타라')
    assert.equal(hanatourListingSearchWord('상해, 소주, 주가각'), '상해')
    assert.equal(hanatourListingSearchWord('유럽 (코펜하겐 · 뉘하운)'), '유럽')
    assert.equal(hanatourListingSearchWord('파리'), '파리')
    const seed = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EEP133260701KEY'
    assert.deepEqual(
      dropHanatourSeedPkgCd(['EEP133260701KEY', 'JMB331260701BXF'], seed),
      ['JMB331260701BXF'],
    )
    const ht = readFileSync(new URL('../scripts/listing_discover_hanatour/main.py', import.meta.url), 'utf8')
    assert.match(ht, /REGRESSION-FREEZE\[register-hanatour-listing-package-first\]/)
    assert.match(ht, /_without_seed/)
    const ts = readFileSync(new URL('../lib/register-listing-discover-hanatour.ts', import.meta.url), 'utf8')
    assert.match(ts, /hanatourListingSearchWord/)
    assert.match(ts, /dropHanatourSeedPkgCd/)
  })

  it('목록 수집은 홈 검색함으로 들어가고 404 옛 주소를 치지 않는다', () => {
    const vg = readFileSync(new URL('../scripts/listing_discover_verygoodtour/main.py', import.meta.url), 'utf8')
    assert.match(vg, /REGRESSION-FREEZE\[register-listing-discover-human-search-not-404\]/)
    assert.match(vg, /_browse_overseas/)
    assert.match(vg, /www\.verygoodtour\.com\//)
    assert.equal(vg.includes('Product/ProductList'), false)
    const md = readFileSync(new URL('../scripts/listing_discover_modetour/main.py', import.meta.url), 'utf8')
    assert.match(md, /REGRESSION-FREEZE\[register-listing-discover-human-search-not-404\]/)
    assert.match(md, /_browse_overseas/)
    assert.equal(md.includes('modetour.com/search?keyword='), false)
    const ht = readFileSync(new URL('../scripts/listing_discover_hanatour/main.py', import.meta.url), 'utf8')
    assert.equal(ht.includes('CHPC0PKG0119P200'), false)
    assert.equal(ht.includes('package?keyword='), false)
    const vgTs = readFileSync(new URL('../lib/register-listing-discover-verygoodtour.ts', import.meta.url), 'utf8')
    assert.equal(vgTs.includes('Product/ProductList'), false)
    const mdTs = readFileSync(new URL('../lib/register-listing-discover-modetour.ts', import.meta.url), 'utf8')
    assert.equal(mdTs.includes('modetour.com/search?keyword='), false)
    const htTs = readFileSync(new URL('../lib/register-listing-discover-hanatour.ts', import.meta.url), 'utf8')
    assert.equal(htTs.includes('CHPC0PKG0119P200'), false)
  })

  it('메가메뉴 나라·도시만 클릭하고 검색하지 않는다', () => {
    assert.equal(megaMenuClickLabelForIngestSlot({ cityKey: 'tokyo', countryKey: 'japan' }), '도쿄')
    assert.equal(megaMenuClickLabelForIngestSlot({ cityKey: 'danang', countryKey: 'vietnam' }), '다낭')
    assert.equal(megaMenuClickLabelForIngestSlot({ cityKey: null, countryKey: 'france' }), '프랑스')
    assert.equal(megaMenuClickLabelForIngestSlot({ cityKey: 'osaka', countryKey: 'japan' }), '오사카')
    const slots = buildRegisterPrePhotoIngestGeoSlots([
      row({
        originSource: 'hanatour',
        originUrl: 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=EEP133260701KEY',
        countryKey: 'france',
        destination: '마케팅 문장은 쓰지 않음',
      }),
    ])
    assert.equal(slots[0]?.searchWord, '프랑스')
    for (const rel of [
      '../scripts/listing_discover_hanatour/main.py',
      '../scripts/listing_discover_modetour/main.py',
      '../scripts/listing_discover_verygoodtour/main.py',
      '../scripts/listing_discover_ybtour/main.py',
      '../scripts/listing_discover_kyowontour/main.py',
      '../scripts/listing_discover_lottetour/main.py',
      '../scripts/listing_discover_naeiltour/main.py',
    ]) {
      const py = readFileSync(new URL(rel, import.meta.url), 'utf8')
      assert.match(py, /_browse_overseas/)
      assert.match(py, /해외여행/)
      assert.equal(py.includes('loc.type(word'), false)
    }
  })

  it('검증 실패·파서 수정 필요는 등록대기에 올리지 않는다', () => {
    assert.equal(isRegisterPrePhotoPendingQueueReady({ ok: true }), true)
    assert.equal(isRegisterPrePhotoPendingQueueReady({ ok: false }), false)
    assert.equal(registrationStatusAfterPrePhotoVerify({ ok: true }), 'pending')
    assert.equal(REGISTER_PRE_PHOTO_BLOCKED_STATUS, 'pre_photo_blocked')
    assert.equal(registrationStatusAfterPrePhotoVerify({ ok: false }), REGISTER_PRE_PHOTO_BLOCKED_STATUS)
    assert.equal(occupiesRegisterPrePhotoIngestSlot('pending'), true)
    assert.equal(occupiesRegisterPrePhotoIngestSlot(REGISTER_PRE_PHOTO_BLOCKED_STATUS), false)
    assert.equal(occupiesRegisterPrePhotoIngestSlot('registered'), false)

    const slots = buildRegisterPrePhotoIngestGeoSlots([
      row({
        originSource: 'ybtour',
        originUrl: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAB001&evCd=AVP4484-260711RS00',
        countryKey: 'france',
        destination: '프랑스',
        registrationStatus: REGISTER_PRE_PHOTO_BLOCKED_STATUS,
      }),
    ])
    assert.equal(slots.find((s) => s.supplier === 'ybtour' && s.lane === 'package')?.pending, 0)

    const pendingRoute = readFileSync(new URL('../app/api/admin/products/pending/route.ts', import.meta.url), 'utf8')
    assert.match(pendingRoute, /isRegisterPrePhotoPendingQueueReady/)
    const ingestSrc = readFileSync(new URL('../lib/register-pre-photo-listing-ingest.ts', import.meta.url), 'utf8')
    assert.match(ingestSrc, /discoveredListingFitsIngestLane/)
    const originSrc = readFileSync(new URL('../lib/register-ingest-api-origin.ts', import.meta.url), 'utf8')
    assert.match(originSrc, /getRegisterIngestApiOrigin/)
    const dash = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8')
    assert.match(dash, /countLiveRegisterPrePhotoPendingQueue/)
    assert.equal(dash.includes("prisma.product.count({ where: { registrationStatus: 'pending' } })"), false)
    assert.match(ingestSrc, /pre_photo_verify_failed/)
    assert.match(ingestSrc, /if \(!confirm\.ok\)/)
    const confirmSrc = readFileSync(new URL('../lib/register-pre-photo-ingest-confirm.ts', import.meta.url), 'utf8')
    assert.match(confirmSrc, /confirm_threw/)
    assert.match(confirmSrc, /healPendingRegisterPrePhoto/)
    const healPendingSrc = readFileSync(new URL('../lib/register-pending-pre-photo-self-heal.ts', import.meta.url), 'utf8')
    assert.match(healPendingSrc, /withPrismaRetry/)
    assert.match(healPendingSrc, /heal-pending:/)
    const dailyJobSrc = readFileSync(new URL('../lib/register-pre-photo-daily-job.ts', import.meta.url), 'utf8')
    assert.match(dailyJobSrc, /healLimit \?\? 200/)
    const afterSave = readFileSync(new URL('../lib/register-confirm-after-save.ts', import.meta.url), 'utf8')
    assert.match(afterSave, /applyRegisterPrePhotoQueueGateAfterSave/)
    assert.match(afterSave, /revalidateProductListingCaches/)
    const ybFlow = readFileSync(new URL('../lib/ybtour-register-flow.ts', import.meta.url), 'utf8')
    assert.match(ybFlow, /finalizeRegisterConfirmAfterSave/)
    assert.equal(ybFlow.includes('revalidateProductListingCaches()'), false)
    const statusSrc = readFileSync(new URL('../lib/register-confirm-registration-status.ts', import.meta.url), 'utf8')
    assert.equal(statusSrc.includes("return 'pending'"), false)
    assert.match(statusSrc, /REGISTER_PRE_PHOTO_BLOCKED_STATUS/)
    assert.equal(isRegisterPrePhotoKeywordPhotoGateStatus('pre_photo_blocked'), true)
    assert.equal(isRegisterPrePhotoKeywordPhotoGateStatus('registered'), false)
    const panel = readFileSync(
      new URL('../app/admin/pending/components/AdminPendingDetailPanel.tsx', import.meta.url),
      'utf8',
    )
    assert.equal(panel.includes('등록대기만'), false)
  })

  it('해외 패키지는 노옵션·노쇼핑 상품을 목록에서 먼저 고른다', () => {
    assert.equal(listingHaystackNoOptionNoShoppingScore('[노쇼핑/노옵션] 서유럽 9일'), 4)
    assert.equal(listingHaystackIsNoOptionNoShopping('노팁 노옵션 노쇼핑'), true)
    assert.equal(listingHaystackIsNoOptionNoShopping('쇼핑 3회 포함'), false)
    const ordered = orderListingUrlsPreferNoOptionNoShopping(
      ['https://a.example/shop', 'https://a.example/clean'],
      (url) => (url.endsWith('clean') ? '[노쇼핑] [노옵션]' : '쇼핑 3회'),
    )
    assert.deepEqual(ordered, ['https://a.example/clean', 'https://a.example/shop'])
    const kw = readFileSync(new URL('../scripts/listing_discover_kyowontour/main.py', import.meta.url), 'utf8')
    assert.match(kw, /REGRESSION-FREEZE\[register-pre-photo-ingest-no-option-no-shopping\]/)
    assert.match(kw, /_prefer_listing_no_shop_option_filters/)
    const prefer = readFileSync(new URL('../scripts/listing_prefer_no_shop_option.py', import.meta.url), 'utf8')
    assert.match(prefer, /order_codes_prefer_no_option_no_shopping/)
    const src = readFileSync(new URL('../lib/register-pre-photo-ingest-no-option-no-shopping.ts', import.meta.url), 'utf8')
    assert.match(src, /REGRESSION-FREEZE\[register-pre-photo-ingest-no-option-no-shopping\]/)
  })
})
