'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'
import { TrialOperationNoticeModal } from '../overlays/TrialOperationNoticeModal'

export default function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
      <TrialOperationNoticeModal />
    </NextAuthSessionProvider>
  )
}
