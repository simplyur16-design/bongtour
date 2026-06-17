'use client'

import { useState } from 'react'
import type { MetaConnectionPublic } from './page'

type Props = {
  connection: MetaConnectionPublic | null
  successMsg?: string
  errorMsg?: string
}

export default function IntegrationsClient({ connection, successMsg, errorMsg }: Props) {
  const [disconnecting, setDisconnecting] = useState(false)

  const isExpired = connection ? new Date(connection.userTokenExpiresAt) < new Date() : false
  const daysUntilExpiry = connection
    ? Math.floor(
        (new Date(connection.userTokenExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      )
    : null

  async function handleDisconnect() {
    if (!confirm('Meta 연결을 해제하시겠어요? 인사이트 수집이 중단됩니다.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/admin/marketing/integrations/meta', { method: 'DELETE' })
      if (res.ok) window.location.reload()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">외부 연동 — Meta (페북·인스타)</h1>
        <p className="mt-1 text-sm text-bt-body/70">
          Meta Graph API로 게시물 인사이트를 수집하고 후킹 라이브러리 학습에 활용합니다.
        </p>
      </div>

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Meta 연결이 완료되었습니다.
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          오류: {errorMsg}
        </div>
      )}

      {!connection && (
        <div className="rounded-xl border border-bt-border-strong bg-white p-5 shadow-sm">
          <p className="text-sm text-bt-body/70">
            Meta (페북·인스타) 계정을 연결하면 게시물 인사이트를 자동 수집합니다.
          </p>
          <a
            href="/api/auth/meta"
            className="mt-4 inline-block rounded-lg bg-bt-brand-blue px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Meta 연결하기
          </a>
        </div>
      )}

      {connection && (
        <div className="rounded-xl border border-bt-border-strong bg-white p-5 shadow-sm">
          <p className={`text-sm font-medium ${isExpired ? 'text-red-600' : 'text-emerald-700'}`}>
            {isExpired ? '만료됨 — 재연결 필요' : '연결됨'}
          </p>

          <dl className="mt-3 space-y-1 text-sm text-bt-body">
            <div>
              <dt className="inline font-medium text-bt-title">페이지: </dt>
              <dd className="inline">
                {connection.pageName || '—'} ({connection.pageId || '—'})
              </dd>
            </div>
            <div>
              <dt className="inline font-medium text-bt-title">인스타 비즈니스 ID: </dt>
              <dd className="inline">{connection.instagramBusinessId || '없음'}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-bt-title">연결 시각: </dt>
              <dd className="inline">{new Date(connection.connectedAt).toLocaleString('ko-KR')}</dd>
            </div>
            <div className={isExpired ? 'text-red-600' : ''}>
              <dt className="inline font-medium">토큰 만료까지: </dt>
              <dd className="inline">{daysUntilExpiry}일</dd>
            </div>
            {connection.lastRefreshedAt && (
              <div>
                <dt className="inline font-medium text-bt-title">마지막 갱신: </dt>
                <dd className="inline">
                  {new Date(connection.lastRefreshedAt).toLocaleString('ko-KR')}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {isExpired && (
              <a
                href="/api/auth/meta"
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                재연결
              </a>
            )}
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg border border-bt-border px-4 py-2 text-sm hover:bg-bt-bg-soft disabled:opacity-50"
            >
              {disconnecting ? '연결 해제 중…' : '연결 해제'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
