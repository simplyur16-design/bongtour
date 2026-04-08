import Link from 'next/link'
import Header from '@/app/components/Header'

type Props = {
  searchParams: Promise<{ error?: string }>
}

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: '접근 권한이 없습니다',
    description:
      '관리자 페이지는 관리자 계정으로 로그인한 경우에만 이용할 수 있습니다. 사장님 계정으로 로그인했는지 확인해 주세요.',
  },
  Configuration: {
    title: '설정 오류',
    description: '로그인 설정에 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
  },
  Verification: {
    title: '이메일 인증 필요',
    description:
      '로그인을 완료하려면 카카오에서 이메일 제공에 동의해 주세요. 이메일은 관리자 권한 확인용으로만 사용됩니다.',
  },
  OAuthAccountNotLinked: {
    title: '다른 계정으로 이미 가입됨',
    description: '이 이메일은 다른 로그인 방식으로 이미 사용 중입니다. 기존에 사용하신 방식으로 로그인해 주세요.',
  },
  Default: {
    title: '로그인 중 문제가 발생했습니다',
    description:
      '로그인을 취소하셨거나, 이메일 제공을 거부하셨을 수 있습니다. 다시 시도하시거나 다른 방법으로 문의해 주세요.',
  },
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams
  const msg = (error && ERROR_MESSAGES[error]) || ERROR_MESSAGES.Default

  return (
    <div className="min-h-screen bg-beige">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
        <div className="w-full border-l-4 border-bt-strong bg-bt-surface py-4 pl-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-bt-title">안내</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-bt-title">{msg.title}</h1>
        </div>
        <p className="mt-2 text-center text-sm text-bt-body">{msg.description}</p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/auth/signin"
            className="border border-bt-cta-primary bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
          >
            다시 로그인
          </Link>
          <Link
            href="/"
            className="border border-bt-cta-secondary-border bg-bt-cta-secondary px-4 py-2 text-sm font-medium text-bt-cta-secondary-text hover:bg-bt-surface-soft"
          >
            홈으로
          </Link>
        </div>
      </main>
    </div>
  )
}
