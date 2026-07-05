export type SignInMethod = 'kakao' | 'naver' | 'google' | 'email'

type MethodOption = {
  id: SignInMethod
  label: string
  description: string
  enabled: boolean
  href: string
}

type Props = {
  callbackUrl: string
  csrfToken: string
  options: MethodOption[]
}

const TILE_CLASS =
  'flex w-full flex-col items-start gap-1 rounded-xl border border-bt-border-soft bg-bt-surface px-4 py-4 text-left transition hover:border-bt-border-strong hover:bg-bt-page hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-brand-blue-strong'

/** OAuth 는 `<a>`·`<form POST>` 만 — Next.js Link 사용 시 같은 페이지만 새로고침됨 */
export default function SignInMethodChooser({ callbackUrl, csrfToken, options }: Props) {
  const enabled = options.filter((o) => o.enabled)

  return (
    <div className="w-full max-w-sm">
      <p className="mb-4 text-center text-sm font-medium text-bt-body">로그인 방법을 선택해 주세요</p>
      <div className="grid grid-cols-2 gap-3">
        {enabled.map((opt) => {
          if (opt.id === 'google') {
            if (!csrfToken) return null
            return (
              <form key={opt.id} action="/api/auth/signin/google" method="POST" className="contents">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <button type="submit" className={TILE_CLASS}>
                  <MethodIcon method={opt.id} />
                  <span className="mt-2 text-sm font-semibold text-bt-strong">{opt.label}</span>
                  <span className="text-[11px] leading-snug text-bt-meta">{opt.description}</span>
                </button>
              </form>
            )
          }

          return (
            <a key={opt.id} href={opt.href} className={TILE_CLASS}>
              <MethodIcon method={opt.id} />
              <span className="mt-2 text-sm font-semibold text-bt-strong">{opt.label}</span>
              <span className="text-[11px] leading-snug text-bt-meta">{opt.description}</span>
            </a>
          )
        })}
      </div>
      {enabled.length === 0 ? (
        <p className="mt-4 text-center text-xs text-bt-meta">사용 가능한 로그인 방법이 없습니다.</p>
      ) : null}
    </div>
  )
}

function MethodIcon({ method }: { method: SignInMethod }) {
  if (method === 'kakao') {
    return (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold"
        style={{ backgroundColor: '#FEE500', color: '#191919' }}
      >
        Ka
      </span>
    )
  }
  if (method === 'naver') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#03A94D] text-xs font-bold text-white">
        N
      </span>
    )
  }
  if (method === 'google') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-bt-border-soft bg-white">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bt-brand-blue-soft text-bt-brand-blue-strong">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 8l8 5 8-5M4 8v8l8 5 8-5V8" />
      </svg>
    </span>
  )
}
