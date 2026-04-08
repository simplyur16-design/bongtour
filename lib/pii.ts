export function maskPhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

export function maskEmail(email: string): string {
  const v = String(email ?? '').trim()
  const at = v.indexOf('@')
  if (at <= 1) return v
  const name = v.slice(0, at)
  const domain = v.slice(at + 1)
  return `${name[0]}***@${domain}`
}
