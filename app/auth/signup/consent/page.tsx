import { redirect } from 'next/navigation'
import Header from '@/app/components/Header'
import { auth } from '@/auth'
import ConsentClient from '@/components/auth/ConsentClient'

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function SignupConsentPage({ searchParams }: Props) {
  const session = await auth()
  const status = (session?.user as { accountStatus?: string } | undefined)?.accountStatus
  const userId = (session?.user as { id?: string } | undefined)?.id?.trim()

  if (!userId || status !== 'consent_pending') {
    redirect('/')
  }

  const sp = await searchParams
  const callbackUrl = typeof sp.callbackUrl === 'string' ? sp.callbackUrl : '/'

  return (
    <div className="min-h-screen bg-beige">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-14">
        <ConsentClient callbackUrl={callbackUrl} />
      </main>
    </div>
  )
}
