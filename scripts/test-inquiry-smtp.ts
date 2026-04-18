/**
 * 문의 접수 알림 메일(SMTP) 스모크 — `lib/inquiry-email.ts` 와 동일 env 규약.
 *
 * 사용:
 *   npx tsx scripts/test-inquiry-smtp.ts              # .env.local / .env 의 실제 SMTP 사용
 *   npx tsx scripts/test-inquiry-smtp.ts --ethereal   # Ethereal (구조용, 운영 검수 **아님**)
 *
 * **운영 최종 검수**는 `npm run verify:inquiry:live` 만 사용한다. `--ethereal` 결과로는 통과 인정하지 말 것.
 *
 * 필수: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL, INQUIRY_NOTIFICATION_EMAIL
 * SMTP_SECURE — "true" 이면 465 TLS, 아니면 STARTTLS(보통 587)
 */
import nodemailer from 'nodemailer'

import './load-env-for-scripts'
import { sendInquiryReceivedEmail } from '@/lib/inquiry-email'

function hasRealSmtp(): boolean {
  const host = process.env.SMTP_HOST?.trim()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const fromName = process.env.SMTP_FROM_NAME?.trim()
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
  const to = process.env.INQUIRY_NOTIFICATION_EMAIL?.trim()
  const secure = process.env.SMTP_SECURE === 'true'
  const port = Number(portRaw || (secure ? 465 : 587))
  return Boolean(host && portRaw && user && pass && fromName && fromEmail && to && Number.isFinite(port) && port > 0)
}

async function applyEtherealEnv(): Promise<void> {
  const acc = await nodemailer.createTestAccount()
  process.env.SMTP_HOST = 'smtp.ethereal.email'
  process.env.SMTP_PORT = '587'
  process.env.SMTP_SECURE = 'false'
  process.env.SMTP_USER = acc.user
  process.env.SMTP_PASS = acc.pass
  process.env.SMTP_FROM_NAME = 'BongTour SMTP smoke'
  process.env.SMTP_FROM_EMAIL = acc.user
  process.env.INQUIRY_NOTIFICATION_EMAIL = 'inquiry-receiver@example.com'
  console.log('[test-inquiry-smtp] Ethereal test account user:', acc.user)
}

async function main(): Promise<void> {
  const useEthereal = process.argv.includes('--ethereal')

  if (useEthereal) {
    console.warn('[test-inquiry-smtp] --ethereal 은 개발/구조 스모크입니다. npm run verify:inquiry:live 가 운영 검수입니다.')
    await applyEtherealEnv()
  } else if (!hasRealSmtp()) {
    console.error(
      '[test-inquiry-smtp] 실제 SMTP env 가 부족합니다. `.env.local` 에 SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL, INQUIRY_NOTIFICATION_EMAIL 을 채우거나 `--ethereal` 로 스모크하세요.'
    )
    process.exit(2)
  }

  const inquiryId = `smtp-smoke-${Date.now()}`
  const info = await sendInquiryReceivedEmail({
    inquiryId,
    inquiryType: 'travel_consult',
    applicantName: 'SMTP 스모크',
    applicantPhone: '010-0000-0000',
    applicantEmail: 'smoke@example.com',
    message: 'scripts/test-inquiry-smtp.ts 에서 발송한 테스트입니다.',
    sourcePagePath: '/inquiry?type=travel',
    createdAtIso: new Date().toISOString(),
    payloadJson: null,
    productId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
    product: null,
  })

  console.log('[test-inquiry-smtp] sendMail ok messageId:', info.messageId)
  if (useEthereal) {
    const preview = nodemailer.getTestMessageUrl(info)
    if (preview) console.log('[test-inquiry-smtp] Ethereal 미리보기:', preview)
  }
}

main().catch((e) => {
  console.error('[test-inquiry-smtp] failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
