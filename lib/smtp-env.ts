/**
 * SMTP host resolution — Railway may refuse to persist the literal key `SMTP_HOST`.
 * Prefer `SMTP_HOST`, fall back to `SMTP_MAIL_HOST` (ops alias).
 * REGRESSION-FREEZE[auth-password-reset]: smtp host alias — manifest
 */

export function getSmtpHost(): string {
  return (
    process.env.SMTP_HOST?.trim() ||
    process.env.SMTP_MAIL_HOST?.trim() ||
    ''
  )
}

export function isSmtpHostConfigured(): boolean {
  return Boolean(getSmtpHost())
}

/** Keys required to send any transactional mail (password-reset / inquiry / booking). */
export function smtpMissingEnvKeys(): string[] {
  const missing: string[] = []
  if (!getSmtpHost()) missing.push('SMTP_HOST|SMTP_MAIL_HOST')
  if (!process.env.SMTP_PORT?.trim()) missing.push('SMTP_PORT')
  if (!process.env.SMTP_USER?.trim()) missing.push('SMTP_USER')
  if (!process.env.SMTP_PASS?.trim()) missing.push('SMTP_PASS')
  if (!process.env.SMTP_FROM_NAME?.trim()) missing.push('SMTP_FROM_NAME')
  if (!process.env.SMTP_FROM_EMAIL?.trim()) missing.push('SMTP_FROM_EMAIL')
  return missing
}

export function isSmtpConfigured(): boolean {
  return smtpMissingEnvKeys().length === 0
}
