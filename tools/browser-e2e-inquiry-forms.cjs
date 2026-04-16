/* eslint-disable no-console */
/**
 * 상담/문의 폼 실브라우저 검증 (Puppeteer)
 * node tools/browser-e2e-inquiry-forms.cjs
 * 전제: npm run dev → http://localhost:3000
 */
const puppeteer = require('puppeteer')

const BASE = 'http://localhost:3000'

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms)
  })
}

async function run() {
  var browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-popup-blocking'],
  })
  var page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  var lastInquiryRes = { status: null, body: '' }

  page.on('response', async function (res) {
    var u = res.url()
    if (res.request().method() !== 'POST' || u.indexOf('/api/inquiries') === -1) return
    try {
      lastInquiryRes = { status: res.status(), body: await res.text() }
    } catch (e) {
      lastInquiryRes = { status: res.status(), body: '' }
    }
  })

  await page.goto(BASE + '/inquiry?type=travel', { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector('input[name="applicantName"]', { timeout: 60000 })

  await page.type('input[name="applicantName"]', 'E2E문의테스트', { delay: 20 })

  var phoneInput = 'input[name="applicantPhone"]'
  await page.click(phoneInput)
  await page.evaluate(function (sel) {
    document.querySelector(sel).value = ''
  }, phoneInput)
  await page.type(phoneInput, '01012341234', { delay: 30 })
  await sleep(200)
  var phoneVal = await page.$eval(phoneInput, function (el) {
    return el.value
  })

  var emailErrVisible = false
  await page.type('input[name="applicantEmail"]', 'not-an-email', { delay: 20 })
  await page.click('input[type="checkbox"][name="privacyAgreed"]')
  await page.evaluate(function () {
    var btn = Array.from(document.querySelectorAll('button[type="submit"]')).find(function (b) {
      return (b.textContent || '').indexOf('문의 접수하기') !== -1
    })
    if (btn) btn.click()
  })
  await sleep(800)
  var bodyAfterBadEmail = await page.evaluate(function () {
    return document.body.innerText
  })
  emailErrVisible =
    bodyAfterBadEmail.indexOf('올바른 이메일 형식') !== -1 ||
    bodyAfterBadEmail.indexOf('example.com') !== -1

  await page.goto(BASE + '/inquiry?type=travel', { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForSelector('input[name="applicantName"]', { timeout: 60000 })
  await page.type('input[name="applicantName"]', 'E2E최소제출', { delay: 20 })
  await page.click(phoneInput)
  await page.evaluate(function (sel) {
    document.querySelector(sel).value = ''
  }, phoneInput)
  await page.type(phoneInput, '0212345678', { delay: 30 })
  await sleep(150)
  var phoneVal2 = await page.$eval(phoneInput, function (el) {
    return el.value
  })
  // 이메일 비움
  await page.click('input[name="applicantEmail"]')
  await page.evaluate(function () {
    var el = document.querySelector('input[name="applicantEmail"]')
    if (el) {
      el.value = ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.click('input[type="checkbox"][name="privacyAgreed"]')
  await page.evaluate(function () {
    var btn = Array.from(document.querySelectorAll('button[type="submit"]')).find(function (b) {
      return (b.textContent || '').indexOf('문의 접수하기') !== -1
    })
    if (btn) btn.click()
  })

  var successText = false
  var noChannelErr = true
  var debugSnippet = ''
  try {
    await page.waitForFunction(
      function () {
        var t = document.body.innerText
        return t.indexOf('문의가 접수되었습니다') !== -1 || t.indexOf('문의는 정상 접수되었습니다') !== -1
      },
      { timeout: 45000 }
    )
    successText = true
  } catch (e) {
    debugSnippet = await page.evaluate(function () {
      return (document.body.innerText || '').slice(0, 1200)
    })
  }

  if (!successText) {
    noChannelErr = await page.evaluate(function () {
      return document.body.innerText.indexOf('답변받을 방법을 선택해 주세요') === -1
    })
  } else {
    noChannelErr = await page.evaluate(function () {
      return document.body.innerText.indexOf('답변받을 방법을 선택해 주세요') === -1
    })
  }

  var parsed = null
  try {
    parsed = lastInquiryRes.body ? JSON.parse(lastInquiryRes.body) : null
  } catch (e2) {
    parsed = null
  }
  var hasNotificationField = parsed && Object.prototype.hasOwnProperty.call(parsed, 'notification')
  var notificationOk = parsed && parsed.notification ? parsed.notification.ok !== false : null
  var ch = parsed && parsed.notification && parsed.notification.channels ? parsed.notification.channels : null
  var emailChannelOk = ch && ch.email ? ch.email.ok === true : null

  await browser.close()

  console.log(
    JSON.stringify(
      {
        travelPhoneFormat11: phoneVal,
        travelPhoneFormat02: phoneVal2,
        badEmailShowsFormatError: emailErrVisible,
        submitMinimalSuccess: successText,
        noPreferredContactChannelError: noChannelErr,
        lastPostStatus: lastInquiryRes.status,
        lastPostBodyPreview: (lastInquiryRes.body || '').slice(0, 400),
        pageSnippetIfStuck: debugSnippet.slice(0, 500),
        lastPostOk: parsed && parsed.ok !== false,
        responseHasNotification: hasNotificationField,
        responseNotificationOk: notificationOk,
        responseChannelsEmailOk: emailChannelOk,
      },
      null,
      2
    )
  )

  if (!successText || !noChannelErr) process.exit(1)
  if (phoneVal.indexOf('010-') === -1 || phoneVal2.indexOf('02-') === -1) process.exit(1)
  if (parsed && parsed.ok === true && !hasNotificationField) process.exit(1)
}

run().catch(function (e) {
  console.error(e)
  process.exit(1)
})
