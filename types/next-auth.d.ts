import 'next-auth'

declare module 'next-auth' {
  interface User {
    id?: string
    role?: string | null
  }

  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string | null
      accountStatus?: string | null
      /** eSIM 소속 명함 관리자 승인 — 스토어프론트 할인가 표시 */
      affiliationVerified?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string | null
    accountStatus?: string | null
    affiliationVerified?: boolean
  }
}
