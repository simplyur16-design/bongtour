/* eslint-disable no-console */
/**
 * Puppeteer 실브라우저 E2E (CommonJS — TS __name 주입 없음)
 * npx node tools/browser-e2e-booking-modetour.cjs [priced|ondemand|ondemand-slow]
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const BASE = 'http://localhost:3000'
const PRODUCT_ID = 'cmnvfupq400061xuldipptqfp'
const PRODUCT_URL = `${BASE}/products/${PRODUCT_ID}`
const mode = (process.argv[2] || 'priced').toLowerCase()

function counselFieldChecks(clip) {
  return {
    hasKakaoStyleBanner: clip.indexOf('[예약 상담]') !== -1,
    hasSystemId: clip.indexOf('상품번호(시스템):') !== -1,
    hasListing: clip.indexOf('상품번호(리스트·노출):') !== -1,
    hasTitle: clip.indexOf('상품명:') !== -1,
    hasSupplier: clip.indexOf('공급사:') !== -1,
    hasDate: clip.indexOf('2026-04-22') !== -1,
    hasPax: clip.indexOf('인원 구성:') !== -1,
    hasBookingId: clip.indexOf('접수번호:') !== -1,
  }
}

function scrapeOverlayDom(page) {
  return page.evaluate(function () {
    var el = document.querySelector('[role="alertdialog"][aria-labelledby="dep-collect-title"]')
    if (!el) {
      return { found: false, text: '', hasPrimaryTitle: false, hasDelayPhoneLine: false, hasContinueCta: false }
    }
    var text = (el.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      found: true,
      text: text.slice(0, 900),
      hasPrimaryTitle: text.indexOf('가격을 확인하고 있습니다') !== -1,
      hasDelayPhoneLine: text.indexOf('담당자가 예약 가능 금액을 확인해 전화로 연락드리겠습니다') !== -1,
      hasContinueCta: text.indexOf('예약 요청 접수 진행하기') !== -1,
    }
  })
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms)
  })
}

async function clickCalendarNavByAria(page, ariaLabel) {
  var clicked = await page.evaluate(function (label) {
    var r = document.evaluate(
      '//button[@aria-label="' + label + '"]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    )
    var n = r.singleNodeValue
    if (n && typeof n.click === 'function') {
      n.click()
      return true
    }
    return false
  }, ariaLabel)
  if (!clicked) throw new Error('Calendar nav not found: ' + ariaLabel)
}

async function clickNextMonth(page) {
  await clickCalendarNavByAria(page, '다음 달')
}

async function clickPrevMonth(page) {
  await clickCalendarNavByAria(page, '이전 달')
}

async function monthLabel(page) {
  return page.evaluate(function () {
    var dialog = document.querySelector('[role="dialog"]')
    var spans = dialog ? Array.from(dialog.querySelectorAll('span')) : []
    for (var i = 0; i < spans.length; i++) {
      var t = spans[i].textContent || ''
      if (/\d{4}년\s*\d{1,2}월/.test(t)) return t.trim()
    }
    return ''
  })
}

async function gotoCalendarMonth(page, targetY, targetM) {
  for (var guard = 0; guard < 40; guard++) {
    var label = await monthLabel(page)
    var match = label.match(/(\d{4})년\s*(\d{1,2})월/)
    if (!match) throw new Error('No month label: ' + label)
    var y = Number(match[1])
    var m = Number(match[2])
    if (y === targetY && m === targetM) return
    if (y < targetY || (y === targetY && m < targetM)) await clickNextMonth(page)
    else await clickPrevMonth(page)
    await sleep(200)
  }
  throw new Error('gotoCalendarMonth timeout')
}

async function clickCalendarDay(page, dayNum) {
  return page.evaluate(function (d) {
    var dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return false
    var target = String(d)
    var buttons = Array.from(dialog.querySelectorAll('button'))
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i]
      var firstSpan = b.querySelector('span')
      var dayText = ((firstSpan && firstSpan.textContent) || '').trim()
      if (dayText === target) {
        b.click()
        return true
      }
    }
    return false
  }, dayNum)
}

async function runPriced() {
  var posts = []
  var ress = []

  var browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-popup-blocking'],
  })
  var page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  await page.evaluateOnNewDocument(function () {
    var w = window
    var orig = navigator.clipboard.writeText.bind(navigator.clipboard)
    navigator.clipboard.writeText = function (t) {
      w.__clip = t
      return orig(t)
    }
  })

  page.on('request', function (req) {
    var u = req.url()
    if (req.method() === 'POST' && (u.indexOf('/api/bookings') !== -1 || u.indexOf('/api/products/' + PRODUCT_ID) !== -1)) {
      posts.push({ url: u.split('?')[0], postData: req.postData() })
    }
  })

  page.on('response', async function (res) {
    var u = res.url()
    if (res.request().method() !== 'POST') return
    if (u.indexOf('/api/bookings') === -1) return
    try {
      var body = await res.text()
      ress.push({ url: u.split('?')[0], status: res.status(), body: body })
    } catch (e) {
      ress.push({ url: u, status: res.status(), body: '' })
    }
  })

  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForFunction('document.body.innerText.includes("출발일 변경")', { timeout: 60000 })
  await page.evaluate(function () {
    var aside = document.querySelector('aside')
    var root = aside || document.body
    var nodes = Array.from(root.querySelectorAll('button,a'))
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || '').indexOf('출발일 변경') !== -1) {
        nodes[i].click()
        break
      }
    }
  })
  await page.waitForSelector('[role="dialog"]', { timeout: 30000 })
  await gotoCalendarMonth(page, 2026, 4)
  var ok22 = await clickCalendarDay(page, 22)
  if (!ok22) throw new Error('Could not click calendar day 22')
  await page.waitForFunction('!document.querySelector(\'[role="dialog"]\')', { timeout: 15000 }).catch(function () {})
  await sleep(800)

  var cardHasDate = await page.evaluate(function () {
    return document.body.innerText.indexOf('2026-04-22') !== -1
  })

  await page.evaluate(function () {
    var aside = document.querySelector('aside')
    var root = aside || document.body
    var buttons = Array.from(root.querySelectorAll('button'))
    for (var i = 0; i < buttons.length; i++) {
      if ((buttons[i].textContent || '').trim() === '예약 요청 접수') {
        buttons[i].click()
        break
      }
    }
  })

  await page.waitForSelector('#bin-name', { visible: true, timeout: 60000 })
  var modalHasDate = await page.evaluate(function () {
    return document.body.innerText.indexOf('2026-04-22') !== -1
  })

  await page.evaluate(function () {
    function fire(id, v) {
      var el = document.querySelector(id)
      if (!el) return
      el.focus()
      var proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      if (proto && proto.set) proto.set.call(el, v)
      else el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    fire('#bin-name', 'E2E브라우저')
    fire('#bin-phone', '01099998888')
    fire('#bin-email', 'e2e-browser@example.com')
  })

  await page.evaluate(function () {
    var subs = Array.from(document.querySelectorAll('button[type="submit"]'))
    for (var i = 0; i < subs.length; i++) {
      if ((subs[i].textContent || '').indexOf('요청 접수하기') !== -1) {
        subs[i].click()
        break
      }
    }
  })

  await page.waitForFunction(
    'document.body.innerText.includes("요청이 접수되었습니다") || document.body.innerText.includes("접수에 실패")',
    { timeout: 45000 }
  )

  var successVisible = await page.evaluate(function () {
    return document.body.innerText.indexOf('요청이 접수되었습니다') !== -1
  })

  await page.evaluate(function () {
    var layers = Array.from(document.querySelectorAll('.fixed.inset-0'))
    var topZ = 0
    var topEl = null
    for (var i = 0; i < layers.length; i++) {
      var z = parseInt(window.getComputedStyle(layers[i]).zIndex, 10) || 0
      var r = layers[i].getBoundingClientRect()
      if (r.width > 100 && z >= topZ) {
        topZ = z
        topEl = layers[i]
      }
    }
    var root = topEl || document.body
    var buttons = Array.from(root.querySelectorAll('button'))
    for (var j = 0; j < buttons.length; j++) {
      if ((buttons[j].textContent || '').indexOf('1:1 카카오 상담하기') !== -1) {
        buttons[j].click()
        break
      }
    }
  })
  await sleep(1200)
  var clip = await page.evaluate(function () {
    return window.__clip || ''
  })

  var shotDir = path.join(process.cwd(), 'tools', '_e2e-out')
  fs.mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: path.join(shotDir, 'priced-success.png'), fullPage: true })
  await browser.close()

  var bookingPosts = posts.filter(function (p) {
    return p.url.indexOf('/api/bookings') !== -1
  })
  var lastBookingPost = bookingPosts[bookingPosts.length - 1]
  var parsedPayload = null
  try {
    parsedPayload = lastBookingPost && lastBookingPost.postData ? JSON.parse(lastBookingPost.postData) : null
  } catch (e) {
    parsedPayload = null
  }
  var lastRes = ress[ress.length - 1]
  var parsedRes = null
  try {
    parsedRes = lastRes && lastRes.body ? JSON.parse(lastRes.body) : null
  } catch (e) {
    parsedRes = null
  }

  var kakaoChecks = counselFieldChecks(clip)

  console.log(
    JSON.stringify(
      {
        mode: 'priced',
        productUrl: PRODUCT_URL,
        cardShows20260422: cardHasDate,
        modalShows20260422: modalHasDate,
        submitSuccess: successVisible,
        lastBookingRequestUrl: lastBookingPost ? lastBookingPost.url : null,
        requestPayloadKeys: parsedPayload ? Object.keys(parsedPayload) : [],
        requestSelectedDate: parsedPayload ? parsedPayload.selectedDate || parsedPayload.selectedDepartureDate : null,
        responseStatus: lastRes ? lastRes.status : null,
        responsePricingMode: parsedRes ? parsedRes.pricingMode : null,
        responseBookingId: parsedRes ? parsedRes.bookingId : null,
        kakaoClipboardChecks: kakaoChecks,
        kakaoClipboardLength: clip.length,
        screenshot: 'tools/_e2e-out/priced-success.png',
      },
      null,
      2
    )
  )
}

async function runOndemand() {
  var posts = []
  var browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-popup-blocking'],
  })
  var page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  page.on('request', function (req) {
    var u = req.url()
    if (req.method() === 'POST' && u.indexOf('/api/products/' + PRODUCT_ID) !== -1) {
      posts.push({ url: u.split('?')[0], postData: req.postData() })
    }
  })

  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForFunction('document.body.innerText.includes("출발일 변경")', { timeout: 60000 })
  await page.evaluate(function () {
    var aside = document.querySelector('aside')
    var root = aside || document.body
    var nodes = Array.from(root.querySelectorAll('button,a'))
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || '').indexOf('출발일 변경') !== -1) {
        nodes[i].click()
        break
      }
    }
  })
  await page.waitForSelector('[role="dialog"]', { timeout: 30000 })
  await gotoCalendarMonth(page, 2027, 1)
  var ok = await clickCalendarDay(page, 15)
  if (!ok) throw new Error('Could not click day 15')
  await sleep(500)
  var overlaySoon = await page.evaluate(function () {
    return document.body.innerText.indexOf('가격을 확인하고 있습니다.') !== -1
  })
  await sleep(12500)
  var delayedText = await page.evaluate(function () {
    var t = document.body.innerText
    var idx = t.indexOf('가격을 확인')
    return {
      hasDelayLine: t.indexOf('담당자가 예약 가능 금액을 확인해') !== -1,
      hasContinue: t.indexOf('예약 요청 접수 진행하기') !== -1,
      overlayChunk: idx >= 0 ? t.slice(Math.max(0, idx - 20), Math.min(t.length, idx + 400)) : '',
    }
  })

  var rangePosts = posts.filter(function (p) {
    return p.postData && p.postData.indexOf('range-on-demand') !== -1
  })
  var rangeParsed = null
  try {
    rangeParsed = rangePosts[0] && rangePosts[0].postData ? JSON.parse(rangePosts[0].postData) : null
  } catch (e) {
    rangeParsed = null
  }

  var shotDir = path.join(process.cwd(), 'tools', '_e2e-out')
  fs.mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: path.join(shotDir, 'ondemand-delay.png'), fullPage: true })
  await browser.close()

  console.log(
    JSON.stringify(
      {
        mode: 'ondemand',
        productUrl: PRODUCT_URL,
        rangeOnDemandPosts: rangePosts.length,
        rangePayloadMode: rangeParsed ? rangeParsed.mode : null,
        rangePayloadDate: rangeParsed ? rangeParsed.departureDate : null,
        overlayPrimaryWithin500ms: overlaySoon,
        after12500ms: delayedText,
        screenshot: 'tools/_e2e-out/ondemand-delay.png',
      },
      null,
      2
    )
  )
}

/**
 * 서버 `BONGTOUR_E2E_SLOW_RANGE_ON_DEMAND_MS`(예: 14000) 가 켜져 있어야 range-on-demand 응답이 늦어지고,
 * 수집 오버레이가 12초 이상 유지된다. Next dev 를 해당 env 로 띄운 뒤 실행.
 */
async function runOndemandSlow() {
  var posts = []
  var browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-popup-blocking'],
  })
  var page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  page.on('request', function (req) {
    var u = req.url()
    if (req.method() === 'POST' && u.indexOf('/api/products/' + PRODUCT_ID) !== -1) {
      posts.push({ url: u.split('?')[0], postData: req.postData() })
    }
  })

  await page.goto(PRODUCT_URL, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForFunction('document.body.innerText.includes("출발일 변경")', { timeout: 60000 })
  await page.evaluate(function () {
    var aside = document.querySelector('aside')
    var root = aside || document.body
    var nodes = Array.from(root.querySelectorAll('button,a'))
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || '').indexOf('출발일 변경') !== -1) {
        nodes[i].click()
        break
      }
    }
  })
  await page.waitForSelector('[role="dialog"]', { timeout: 30000 })
  await gotoCalendarMonth(page, 2027, 1)
  var ok = await clickCalendarDay(page, 15)
  if (!ok) throw new Error('Could not click day 15')

  var shotDir = path.join(process.cwd(), 'tools', '_e2e-out')
  fs.mkdirSync(shotDir, { recursive: true })

  await sleep(5500)
  var before12 = await scrapeOverlayDom(page)
  await page.screenshot({ path: path.join(shotDir, 'ondemand-slow-before12.png'), fullPage: false })

  await sleep(8000)
  var after12 = await scrapeOverlayDom(page)
  await page.screenshot({ path: path.join(shotDir, 'ondemand-slow-after12.png'), fullPage: false })

  await sleep(4000)
  var afterNetwork = await scrapeOverlayDom(page)

  var rangePosts = posts.filter(function (p) {
    return p.postData && p.postData.indexOf('range-on-demand') !== -1
  })
  var rangeParsed = null
  try {
    rangeParsed = rangePosts[0] && rangePosts[0].postData ? JSON.parse(rangePosts[0].postData) : null
  } catch (e) {
    rangeParsed = null
  }

  await browser.close()

  console.log(
    JSON.stringify(
      {
        mode: 'ondemand-slow',
        productUrl: PRODUCT_URL,
        serverSlowRangeOnDemandMs: 14000,
        rangeOnDemandPosts: rangePosts.length,
        rangePayloadMode: rangeParsed ? rangeParsed.mode : null,
        rangePayloadDate: rangeParsed ? rangeParsed.departureDate : null,
        domAtAbout5sFromPick: before12,
        domAtAbout13sFromPick: after12,
        domAfterNetworkSettled: afterNetwork,
        screenshots: {
          before12: 'tools/_e2e-out/ondemand-slow-before12.png',
          after12: 'tools/_e2e-out/ondemand-slow-after12.png',
        },
      },
      null,
      2
    )
  )
}

var runners = {
  priced: runPriced,
  ondemand: runOndemand,
  'ondemand-slow': runOndemandSlow,
}
;(runners[mode] || runPriced)().catch(function (e) {
  console.error(e)
  process.exit(1)
})
