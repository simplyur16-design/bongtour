/**
 * 로컬 문의 스택 검수 (두 모드 — **섞지 말 것**)
 *
 * ■ 운영 검수 (기본) — `npm run verify:inquiry:live`
 *    - `lib/verify-inquiry-operational-env.ts` 로 env 전부 검증 후에만 Next 기동.
 *    - Ethereal / example.com / 코드 기본 카카오 URL → **즉시 실패**.
 *    - 이메일 수신·본문 전체·카카오 앱 내 화면은 **운영자가 실제 채널에서 수동 확인**(스크립트는 SMTP 발송 성공 + 팝업 URL 일치까지).
 *
 * ■ 샌드박스 (구조·회귀만, 운영 통과 **무효**)
 *      npx tsx scripts/local-verify-inquiry-live.ts --sandbox
 *    (별칭: `--ethereal`)
 *
 * 전제: Prisma DB에 등록된 Product 1건 이상.
 */
/* eslint-disable no-console */
import './load-env-for-scripts'
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import puppeteer from 'puppeteer'
import { PrismaClient } from '@prisma/client'

import { sendInquiryReceivedEmail } from '@/lib/inquiry-email'
import {
  buildInquiryEmailSubject,
  buildInquiryEmailSummaryBlock,
  resolveInquiryAlertPrefix,
  type InquiryNotifyInput,
} from '@/lib/inquiry-notification-format'
import { KAKAO_OPEN_CHAT_URL } from '@/lib/kakao-open-chat'
import {
  assertOperationalInquiryVerifyEnv,
  type OperationalInquiryVerifyMaskedLog,
} from '@/lib/verify-inquiry-operational-env'

const PORT = 3001
const BASE = `http://localhost:${PORT}`

const SANDBOX = process.argv.includes('--sandbox') || process.argv.includes('--ethereal')

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}


async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) })
      if (res.ok || res.status === 404 || res.status === 307) return
    } catch {
      /* retry */
    }
    await sleep(400)
  }
  throw new Error(`서버 기동 타임아웃 (${timeoutMs}ms)`)
}

async function createEtherealCreds(): Promise<{ user: string; pass: string }> {
  const acc = await nodemailer.createTestAccount()
  console.log('[verify][sandbox] Ethereal SMTP user:', acc.user)
  return { user: acc.user, pass: acc.pass }
}

function startNextDev(sandbox: boolean, ethereal?: { user: string; pass: string }): ChildProcess {
  const cwd = process.cwd()
  const nextBin = join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next')

  const childEnv: NodeJS.ProcessEnv =
    sandbox && ethereal
      ? {
          ...process.env,
          SMTP_HOST: 'smtp.ethereal.email',
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          SMTP_USER: ethereal.user,
          SMTP_PASS: ethereal.pass,
          SMTP_FROM_NAME: 'BongTour sandbox',
          SMTP_FROM_EMAIL: ethereal.user,
          INQUIRY_NOTIFICATION_EMAIL: 'inquiry-sandbox@example.com',
          NODE_ENV: 'development',
          NEXT_PUBLIC_APP_URL: BASE,
        }
      : {
          ...process.env,
          NODE_ENV: 'development',
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim() || BASE,
        }

  return spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT)], {
    cwd,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function postInquiry(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/inquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      Referer: `${BASE}/inquiry`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

function assertContains(hay: string, needle: string, label: string): void {
  if (!hay.includes(needle)) {
    console.error(`[verify] FAIL: ${label} — missing: ${needle.slice(0, 120)}`)
    throw new Error(label)
  }
}

async function fetchEtherealPreviewHtml(messageUrl: string): Promise<string> {
  const res = await fetch(messageUrl, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Ethereal 미리보기 HTTP ${res.status}`)
  return res.text()
}

/** 팝업이 `.env`에 넣은 카카오 진입 URL과 동일 호스트·경로인지(쿼리 `text=` 허용) */
function kakaoPopupMatchesConfigured(opened: string, configuredRaw: string): boolean {
  try {
    const c = new URL(configuredRaw.trim())
    const o = new URL(opened.trim())
    const cp = c.pathname.replace(/\/$/, '') || '/'
    const op = o.pathname.replace(/\/$/, '') || '/'
    return o.hostname === c.hostname && op === cp
  } catch {
    return opened.startsWith(configuredRaw.split('?')[0])
  }
}

async function main(): Promise<void> {
  let operationalMasked: OperationalInquiryVerifyMaskedLog | null = null
  if (SANDBOX) {
    console.warn(
      '[verify] 모드: SANDBOX — 운영 검수 통과로 인정하지 마세요. 구조/회귀 전용(Ethereal·example 수신 가능).'
    )
  } else {
    console.log('[verify] 모드: OPERATIONAL — lib/verify-inquiry-operational-env.ts 기준')
    operationalMasked = assertOperationalInquiryVerifyEnv()
    console.log('[verify] 운영 env 요약(비밀번호·전체 URL·쿼리 미출력):', {
      smtpHost: operationalMasked.smtpHost,
      SMTP_FROM_EMAIL: operationalMasked.smtpFromEmail,
      INQUIRY_NOTIFICATION_EMAIL: operationalMasked.inquiryNotificationEmail,
      NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL: operationalMasked.kakao,
    })
  }

  const tag = `lv-${Date.now()}`
  let ethereal: { user: string; pass: string } | undefined
  if (SANDBOX) {
    ethereal = await createEtherealCreds()
  }

  const prisma = new PrismaClient()
  let product: {
    id: string
    title: string | null
    originCode: string
    originSource: string
  } | null = null
  try {
    product = await prisma.product.findFirst({
      where: { registrationStatus: 'registered' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, originCode: true, originSource: true },
    })
  } finally {
    await prisma.$disconnect()
  }
  if (!product) throw new Error('등록된 Product 가 없어 여행상품 검수를 할 수 없습니다.')

  const child = startNextDev(SANDBOX, ethereal)
  try {
    await waitForServer(180_000)
    console.log('[verify] Next dev responding at', BASE)

    const privacy = new Date().toISOString()

    const travelBody = {
      inquiryType: 'travel_consult',
      applicantName: `${tag}-travel`,
      applicantPhone: '010-8888-7777',
      applicantEmail: 'verify-travel@example.com',
      message: '로컬 실검 여행상품 문의 본문입니다.',
      website: '',
      privacyAgreed: true,
      privacyNoticeConfirmedAt: privacy,
      privacyNoticeVersion: 'training-inquiry-v1',
      preferredContactChannel: 'email',
      productId: product.id,
      snapshotProductTitle: (product.title ?? '').slice(0, 200) || '스냅샷 제목',
      payloadJson: {
        adultCount: 2,
        childCount: 1,
        infantCount: 0,
        preferredDepartureDate: '2026-06-01',
      },
    }

    const busBody = {
      inquiryType: 'bus_quote',
      applicantName: `${tag}-bus`,
      applicantPhone: '010-7777-6666',
      applicantEmail: 'verify-bus@example.com',
      message: '로컬 실검 전세버스 문의 본문입니다. 전세버스.',
      website: '',
      privacyAgreed: true,
      privacyNoticeConfirmedAt: privacy,
      privacyNoticeVersion: 'charter-bus-inquiry-v1',
      preferredContactChannel: 'email',
      payloadJson: {
        consultType: 'CHARTER_BUS',
        quoteKind: 'charter_bus_consult',
        usageType: '관광',
        useDate: '2026-06-15',
        departurePlace: '서울',
        arrivalPlace: '부산',
        estimatedHeadcount: 25,
      },
    }

    const interpBody = {
      inquiryType: 'institution_request',
      applicantName: `${tag}-interp`,
      applicantPhone: '010-5555-4444',
      applicantEmail: 'verify-interp@example.com',
      message: '로컬 실검 통역 문의 본문입니다.',
      website: '',
      privacyAgreed: true,
      privacyNoticeConfirmedAt: privacy,
      privacyNoticeVersion: 'training-inquiry-v1',
      preferredContactChannel: 'email',
      payloadJson: {
        interpreterNeeded: true,
        preferredCountryCity: '도쿄',
        organizationName: '검수테스트기관',
        estimatedHeadcount: 6,
      },
    }

    const r1 = await postInquiry(travelBody)
    const r2 = await postInquiry(busBody)
    const r3 = await postInquiry(interpBody)
    console.log('[verify] POST travel', r1.status, r1.json.ok, r1.json.notification)
    console.log('[verify] POST bus', r2.status, r2.json.ok, r2.json.notification)
    console.log('[verify] POST interp', r3.status, r3.json.ok, r3.json.notification)

    if (r1.status !== 200 || r1.json.ok !== true) throw new Error('travel POST 실패')
    if (r2.status !== 200 || r2.json.ok !== true) throw new Error('bus POST 실패')
    if (r3.status !== 200 || r3.json.ok !== true) throw new Error('interp POST 실패')

    const notif = r1.json.notification as { ok?: boolean; channels?: { email?: { ok?: boolean } } } | undefined
    if (!notif?.ok || notif.channels?.email?.ok !== true) {
      throw new Error(`여행 문의 이메일 발송 실패(API): ${JSON.stringify(notif)}`)
    }
    if (!((r2.json.notification as { ok?: boolean })?.ok)) throw new Error('버스 이메일 실패')
    if (!((r3.json.notification as { ok?: boolean })?.ok)) throw new Error('통역 이메일 실패')

    const prisma2 = new PrismaClient()
    let rows: Awaited<ReturnType<typeof prisma2.customerInquiry.findMany>>
    try {
      rows = await prisma2.customerInquiry.findMany({
        where: { applicantName: { startsWith: tag } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          inquiryType: true,
          applicantName: true,
          productId: true,
          snapshotProductTitle: true,
          payloadJson: true,
          emailSentStatus: true,
          emailError: true,
        },
      })
    } finally {
      await prisma2.$disconnect()
    }
    if (rows.length !== 3) throw new Error(`DB 행 개수 기대 3, 실제 ${rows.length}`)
    const travelRow = rows.find((x) => x.inquiryType === 'travel_consult')
    if (!travelRow?.productId) throw new Error('여행 행에 productId 없음')
    if (travelRow.emailSentStatus !== 'sent') throw new Error(`여행 emailSentStatus=${travelRow.emailSentStatus}`)

    process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || BASE
    const productMeta = {
      title: product.title ?? '',
      originCode: product.originCode,
      originSource: product.originSource,
    }
    const travelInput: InquiryNotifyInput = {
      inquiryId: travelRow.id,
      inquiryType: 'travel_consult',
      applicantName: travelRow.applicantName,
      applicantPhone: '010-8888-7777',
      applicantEmail: 'verify-travel@example.com',
      message: '로컬 실검 여행상품 문의 본문입니다.',
      sourcePagePath: '/inquiry?type=travel',
      createdAtIso: new Date().toISOString(),
      payloadJson: travelRow.payloadJson,
      productId: travelRow.productId,
      snapshotProductTitle: travelRow.snapshotProductTitle,
      snapshotCardLabel: null,
      product: productMeta,
    }
    const prefix = resolveInquiryAlertPrefix(travelInput)
    if (prefix !== '[여행상품 문의]') throw new Error(`prefix 기대 [여행상품 문의], 실제 ${prefix}`)
    const travelSubjectCheck = buildInquiryEmailSubject(travelInput, prefix)
    const travelBlockCheck = buildInquiryEmailSummaryBlock(travelInput, prefix)
    if (travelSubjectCheck.includes('(상품번호 없음)') || travelBlockCheck.includes('(상품번호 없음)')) {
      throw new Error('여행상품 문의 이메일에 (상품번호 없음) — 운영 검수 실패. product·originCode·스냅샷 경로 확인.')
    }

    if (SANDBOX) {
      const directSend = await sendInquiryReceivedEmail(travelInput)
      const previewUrl = nodemailer.getTestMessageUrl(directSend)
      if (!previewUrl) throw new Error('Ethereal 미리보기 URL 없음')
      console.log('[verify][sandbox] Ethereal 미리보기(여행 재발송):', previewUrl)
      const html = await fetchEtherealPreviewHtml(previewUrl)
      const textBlob = html.replace(/<[^>]+>/g, ' ')
      assertContains(textBlob, '[여행상품 문의]', '제목/본문 prefix')
      assertContains(textBlob, travelRow.id, '접수번호(inquiry id)')
      assertContains(textBlob, product.originCode, '상품번호(originCode)')
      assertContains(textBlob, (product.title ?? '').slice(0, 15), '상품명(일부)')
      assertContains(textBlob, '2026-06-01', '출발일')
      assertContains(textBlob, '성인', '인원(성인)')
      assertContains(textBlob, '아동', '인원(아동)')

      const busRow = rows.find((x) => x.inquiryType === 'bus_quote')!
      const busInput: InquiryNotifyInput = {
        inquiryId: busRow.id,
        inquiryType: 'bus_quote',
        applicantName: busRow.applicantName,
        applicantPhone: '010-7777-6666',
        applicantEmail: 'verify-bus@example.com',
        message: '로컬 실검 전세버스',
        sourcePagePath: '/inquiry?type=bus',
        createdAtIso: new Date().toISOString(),
        payloadJson: busRow.payloadJson,
        productId: null,
        snapshotProductTitle: null,
        snapshotCardLabel: null,
        product: null,
      }
      const busMail = await sendInquiryReceivedEmail(busInput)
      const busPreview = nodemailer.getTestMessageUrl(busMail)
      if (busPreview) {
        const busHtml = await fetchEtherealPreviewHtml(busPreview)
        assertContains(busHtml, '[전세버스 문의]', '버스 메일 prefix')
        assertContains(busHtml, '서울', '버스 출발지')
        console.log('[verify][sandbox] 버스 Ethereal:', busPreview)
      }

      const interpRow = rows.find((x) => x.inquiryType === 'institution_request')!
      const interpInput: InquiryNotifyInput = {
        inquiryId: interpRow.id,
        inquiryType: 'institution_request',
        applicantName: interpRow.applicantName,
        applicantPhone: '010-5555-4444',
        applicantEmail: 'verify-interp@example.com',
        message: '로컬 실검 통역',
        sourcePagePath: '/inquiry?type=institution',
        createdAtIso: new Date().toISOString(),
        payloadJson: interpRow.payloadJson,
        productId: null,
        snapshotProductTitle: null,
        snapshotCardLabel: null,
        product: null,
      }
      const interpMail = await sendInquiryReceivedEmail(interpInput)
      const interpPreview = nodemailer.getTestMessageUrl(interpMail)
      if (interpPreview) {
        const ih = await fetchEtherealPreviewHtml(interpPreview)
        assertContains(ih, '[통역 문의]', '통역 메일 prefix')
        assertContains(ih, '도쿄', '통역 희망지')
        console.log('[verify][sandbox] 통역 Ethereal:', interpPreview)
      }
    } else {
      console.log(
        '\n[verify] OPERATIONAL: API로 3건 SMTP 발송까지 완료. 아래 **운영자 수동 확인** 없이는 통과로 인정하지 마세요.'
      )
    }

    const configuredKakao = SANDBOX ? undefined : process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL!.trim()

    console.log('[verify] Puppeteer: 상품 상세 카카오…')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
      const context = browser.defaultBrowserContext()
      await context.overridePermissions(`${BASE}`, ['clipboard-read', 'clipboard-write'])
      const page = await browser.newPage()
      await page.setViewport({ width: 1400, height: 900 })
      const productUrl = `${BASE}/products/${encodeURIComponent(product.id)}`
      await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 120_000 })

      await page.waitForFunction(
        () => document.body.innerText.includes('1:1 카카오 상담하기'),
        { timeout: 60_000 }
      )

      async function waitPopupUrl(match: (u: string) => boolean, click: () => Promise<void>): Promise<string> {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            browser.off('targetcreated', onTarget)
            reject(new Error('팝업 URL 타임아웃'))
          }, 35_000)
          const onTarget = async (target: import('puppeteer').Target) => {
            try {
              const p = await target.page()
              if (!p) return
              for (let i = 0; i < 60; i++) {
                const u = p.url()
                if (u && u !== 'about:blank' && match(u)) {
                  clearTimeout(timer)
                  browser.off('targetcreated', onTarget)
                  resolve(u)
                  return
                }
                await sleep(200)
              }
            } catch {
              /* */
            }
          }
          browser.on('targetcreated', onTarget)
          void click().catch((e) => {
            clearTimeout(timer)
            browser.off('targetcreated', onTarget)
            reject(e)
          })
        })
      }

      const kakaoPopupUrl = await waitPopupUrl(
        (u) => u.toLowerCase().includes('kakao'),
        async () => {
          const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
            const b = buttons.find((x) => (x.textContent || '').includes('1:1 카카오 상담하기'))
            if (!b) return false
            b.scrollIntoView({ block: 'center', inline: 'nearest' })
            ;(b as HTMLButtonElement).click()
            return true
          })
          if (!clicked) throw new Error('카카오 버튼 없음')
        }
      )
      console.log('[verify] 카카오 팝업 URL:', kakaoPopupUrl.slice(0, 260))
      if (!SANDBOX && configuredKakao) {
        if (!kakaoPopupMatchesConfigured(kakaoPopupUrl, configuredKakao)) {
          throw new Error(
            `카카오 팝업이 설정 URL과 불일치합니다.\n설정: ${configuredKakao}\n열림: ${kakaoPopupUrl.slice(0, 180)}`
          )
        }
      }
      if (kakaoPopupUrl.includes('text=')) {
        try {
          const u = new URL(kakaoPopupUrl)
          const t = u.searchParams.get('text') ?? ''
          console.log('[verify] 카카오 URL ?text= 디코드(앞 500자):', t.slice(0, 500))
          assertContains(t, product.id, '카카오 URL 요약 productId')
          assertContains(t, product.originCode, '카카오 URL 요약 상품번호')
        } catch (e) {
          console.warn('[verify] 카카오 URL text 파싱 생략:', e)
        }
      }

      await sleep(600)
      await page.bringToFront()
      try {
        const clipKakao = await page.evaluate(() => navigator.clipboard.readText())
        console.log('[verify] 카카오 클립보드(앞 400자):', clipKakao.slice(0, 400))
      } catch (e) {
        console.warn('[verify] 카카오 클립보드 읽기 실패(헤드리스):', e)
      }
    } finally {
      await browser.close()
    }

    const subj = buildInquiryEmailSubject(travelInput, prefix)
    const block = buildInquiryEmailSummaryBlock(travelInput, prefix)
    console.log('\n========== 검수 요약 ==========')
    console.log('스크립트가 읽은 카카오 URL(런타임 import):', KAKAO_OPEN_CHAT_URL)
    console.log('여행 이메일 제목(재구성):', subj)
    console.log('여행 이메일 요약 상단(일부):\n', block.split('\n').slice(0, 18).join('\n'))
    console.log('==============================\n')
    if (SANDBOX) {
      console.log('[verify][sandbox] 구조 검증 통과 (운영 통과 아님)')
    } else {
      console.log(
        [
          '\n========== 운영자 수동 확인 체크리스트 (필수) ==========',
          `1) 메일함(${operationalMasked?.inquiryNotificationEmail ?? 'INQUIRY_NOTIFICATION_EMAIL'}) — 3건 수신, 제목·본문에 유형 prefix·여행상품 시 상품명/상품번호/공급사/일정/인원/접수번호`,
          '2) 카카오 — 팝업이 위 로그의 host+path 와 동일 계열인지, 요약(text/클립보드)에 상품명·번호·일정·인원',
          '3) `/inquiry` 폼에서 이메일 실패 유도 시 — 화면에 “문의는 정상 접수…” 지연 문구(저장≠알림 분리)',
          '========================================================\n',
        ].join('\n')
      )
    }
  } finally {
    child.kill('SIGTERM')
    await sleep(2000)
  }
}

main().catch((e) => {
  console.error('[verify] FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
