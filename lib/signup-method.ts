export const SIGNUP_METHODS = ['email', 'kakao', 'naver', 'google', 'apple'] as const
export type SignupMethod = (typeof SIGNUP_METHODS)[number]

export function displaySignupMethod(m: string | null | undefined): string {
  if (!m) return '—'
  switch (m) {
    case 'email':
      return '이메일'
    case 'kakao':
      return '카카오'
    case 'naver':
      return '네이버'
    case 'google':
      return 'Google'
    case 'apple':
      return 'Apple'
    default:
      return m
  }
}

export function isSignupMethod(v: string): v is SignupMethod {
  return (SIGNUP_METHODS as readonly string[]).includes(v)
}
