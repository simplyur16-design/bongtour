/**
 * 문의 접수 알림 메일(SMTP) 스모크 — `lib/inquiry-email.ts` 와 동일 env 규약.
 *
 * 사용:
 *   npx tsx scripts/test-inquiry-smtp.ts                # .env.local / .env 의 실제 SMTP 사용
 *   npx tsx scripts/test-inquiry-smtp.ts --try-587      # 네이버 535 시: 587+STARTTLS로만 이 실행에서 덮어써 재시도
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

function logSmtpDiagnosticFingerprint(): void {
  const host = process.env.SMTP_HOST?.trim() ?? ''
  const user = process.env.SMTP_USER?.trim() ?? ''
  const pass = process.env.SMTP_PASS?.trim() ?? ''
  const from = process.env.SMTP_FROM_EMAIL?.trim() ?? ''
  const secure = process.env.SMTP_SECURE === 'true'
  const port = Number(process.env.SMTP_PORT?.trim() || (secure ? 465 : 587))
  const naverish = /naver\.com/i.test(host)
  console.log(
    '[test-inquiry-smtp] smtp_fingerprint (비밀 미포함)',
    JSON.stringify({
      SMTP_HOST: host || null,
      SMTP_PORT: process.env.SMTP_PORT?.trim() ?? null,
      SMTP_SECURE: process.env.SMTP_SECURE ?? null,
      resolved_port: Number.isFinite(port) ? port : null,
      smtp_user_char_count: user.length,
      smtp_user_is_id_at_naver_com: /@naver\.com$/i.test(user),
      smtp_pass_char_count: pass.length,
      naver_app_password_ui_hint: naverish
        ? '보안→애플리케이션 비밀번호: IMAP·POP·SMTP 동일 사용(12자리 대문자+숫자 안내). smtp_pass_char_count·문자 종류 일치 확인'
        : null,
      from_email_matches_smtp_user: Boolean(from && user && from.toLowerCase() === user.toLowerCase()),
    })
  )
}

async function main(): Promise<void> {
  /** 터미널에 붙여넣을 때 “지금 디스크의 이 파일”이 실행됐는지 구분용 (535 안내 문구만으로는 구버전과 혼동 가능) */
  console.log('[test-inquiry-smtp] script_version 2026-04-15-try587')

  const useEthereal = process.argv.includes('--ethereal')
  const try587 = process.argv.includes('--try-587')

  if (!useEthereal && try587) {
    process.env.SMTP_PORT = '587'
    process.env.SMTP_SECURE = 'false'
    console.warn(
      '[test-inquiry-smtp] --try-587: 이번 실행만 SMTP_PORT=587, SMTP_SECURE=false 로 바꿔 시도합니다. 통과하면 .env.local 도 동일하게 맞추세요.'
    )
  }

  if (useEthereal) {
    console.warn('[test-inquiry-smtp] --ethereal 은 개발/구조 스모크입니다. npm run verify:inquiry:live 가 운영 검수입니다.')
    await applyEtherealEnv()
  } else if (!hasRealSmtp()) {
    console.error(
      '[test-inquiry-smtp] 실제 SMTP env 가 부족합니다. `.env.local` 에 SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL, INQUIRY_NOTIFICATION_EMAIL 을 채우거나 `--ethereal` 로 스모크하세요.'
    )
    process.exit(2)
  }

  if (!useEthereal) {
    logSmtpDiagnosticFingerprint()
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
  const msg = e instanceof Error ? e.message : String(e)
  console.error('[test-inquiry-smtp] failed:', msg)
  if (/535|Username and Password not accepted/i.test(msg)) {
    console.error('[test-inquiry-smtp] 네이버(nsmtp) 535 요약 (한 줄씩):')
    console.error('  · SMTP_PASS = 계정 보안의 애플리케이션 비밀번호(IMAP·POP·SMTP 동일). 웹 로그인 비번 아님.')
    console.error('  · 웹메일 환경설정 POP3/IMAP·SMTP 에서 SMTP 사용 켜기.')
    console.error('  · 포트: 587 + SMTP_SECURE=false 또는 465 + SMTP_SECURE=true (한 세트). 465만 계속 실패면: npx tsx scripts/test-inquiry-smtp.ts --try-587')
    console.error('  · PowerShell에 SMTP_USER, SMTP_PASS 등이 이미 있으면 .env.local 보다 우선됨. 확인 후 제거.')
    console.error('  · 발급한 12자와 smtp_fingerprint 의 smtp_pass_char_count·대문자/숫자 일치 재확인.')
  }
  process.exit(1)
})
