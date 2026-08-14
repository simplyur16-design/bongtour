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
