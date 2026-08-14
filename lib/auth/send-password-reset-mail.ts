import nodemailer from 'nodemailer'
import { getSmtpHost } from '@/lib/smtp-env'

export type SendPasswordResetMailInput = {
  to: string
  resetUrl: string
  /** Optional simplyur app deep link (mobile requests). */
  deepLink?: string
  brand: 'bongtour' | 'simplyur'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPasswordResetMailContent(input: SendPasswordResetMailInput): {
  subject: string
  text: string
  html: string
} {
  const brandLabel = input.brand === 'simplyur' ? 'simplyur' : 'Bong투어'
  const subject =
    input.brand === 'simplyur'
      ? '[simplyur] Reset your password'
      : '[Bong투어] 비밀번호 재설정'
  const deepLines =
    input.deepLink
      ? input.brand === 'simplyur'
        ? ['', 'Or open in the simplyur app:', input.deepLink]
        : ['', '앱에서 열기:', input.deepLink]
      : []
  const text =
    input.brand === 'simplyur'
      ? [
          'Reset your simplyur password using the link below.',
          '',
          input.resetUrl,
          ...deepLines,
          '',
          'This link expires in about 1 hour.',
          'If you did not request this, you can ignore this email.',
        ].join('\n')
      : [
          '아래 링크로 Bong투어 비밀번호를 재설정할 수 있습니다.',
          '',
          input.resetUrl,
          ...deepLines,
          '',
          '링크는 약 1시간 후 만료됩니다.',
          '본인이 요청하지 않았다면 이 메일을 무시해 주세요.',
        ].join('\n')

  const safeUrl = escapeHtml(input.resetUrl)
  const safeDeep = input.deepLink ? escapeHtml(input.deepLink) : ''
  const cta =
    input.brand === 'simplyur' ? 'Reset password' : '비밀번호 재설정'
  const note =
    input.brand === 'simplyur'
      ? 'This link expires in about 1 hour. If you did not request this, ignore this email.'
      : '링크는 약 1시간 후 만료됩니다. 본인이 요청하지 않았다면 무시해 주세요.'
  const deepHtml = safeDeep
    ? `<p style="font-size:13px;word-break:break-all;">App: <a href="${safeDeep}">${safeDeep}</a></p>`
    : ''

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#1e293b;line-height:1.6;">
  <p>${escapeHtml(brandLabel)} password reset</p>
  <p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(cta)}</a></p>
  <p style="font-size:13px;word-break:break-all;"><a href="${safeUrl}">${safeUrl}</a></p>
  ${deepHtml}
  <p style="font-size:14px;color:#64748b;">${escapeHtml(note)}</p>
</body></html>`

  return { subject, text, html }
}

/**
 * REGRESSION-FREEZE[auth-password-reset]: SMTP password-reset mail — manifest
 */
export async function sendPasswordResetMail(
  input: SendPasswordResetMailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = getSmtpHost()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const fromName = process.env.SMTP_FROM_NAME?.trim()
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
  const secure = process.env.SMTP_SECURE === 'true'
  const port = Number(portRaw || (secure ? 465 : 587))

  if (!host || !portRaw || !user || !pass || !fromName || !fromEmail) {
    return { ok: false, error: 'smtp_not_configured' }
  }
  if (!Number.isFinite(port) || port <= 0) {
    return { ok: false, error: 'smtp_port_invalid' }
  }

  const to = input.to.trim().toLowerCase()
  if (!to.includes('@')) {
    return { ok: false, error: 'invalid_recipient' }
  }

  const { subject, text, html } = buildPasswordResetMailContent(input)

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      ...(!secure && port === 587 ? { requireTLS: true as const } : {}),
    })
    await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to,
      subject,
      text,
      html,
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send_failed'
    return { ok: false, error: msg.slice(0, 500) }
  }
}
