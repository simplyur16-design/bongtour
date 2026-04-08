'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminEmptyState from '../components/AdminEmptyState'
import AdminKpiCard from '../components/AdminKpiCard'
import AdminPageHeader from '../components/AdminPageHeader'
import AdminStatusBadge from '../components/AdminStatusBadge'
import AdminPendingDetailPanel from './components/AdminPendingDetailPanel'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

type PendingItem = {
  id: string
  originCode: string
  originSource: string
  title: string
  destination: string | null
  duration: string | null
  updatedAt: string
  photosReady: boolean
  primaryRegion: string | null
  displayCategory: string | null
}

/** 목록 API 실패 UX용 (401/403은 API 문구 대신 전용 안내) */
type ListLoadError =
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'server'; status: number; message: string }
  | { kind: 'client'; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'timeout' }

export default function AdminPendingPage() {
  const [list, setList] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<ListLoadError | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [registeringId, setRegisteringId] = useState<string | null>(null)
  const [holdingId, setHoldingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [registeredMessage, setRegisteredMessage] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    setListError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch('/api/admin/products/pending', { signal: controller.signal })
      clearTimeout(timeoutId)
      const text = await res.text()
      if (!res.ok) {
        if (res.status === 401) {
          setListError({ kind: 'unauthorized' })
          setList([])
          return
        }
        if (res.status === 403) {
          setListError({ kind: 'forbidden' })
          setList([])
          return
        }
        let errMsg = '목록을 불러오지 못했습니다.'
        if (text) {
          try {
            const errJson = JSON.parse(text) as { error?: string }
            if (typeof errJson?.error === 'string') errMsg = errJson.error
          } catch {
            if (text.length < 200) errMsg = text
          }
        }
        if (res.status >= 500) {
          setListError({ kind: 'server', status: res.status, message: errMsg })
        } else {
          setListError({ kind: 'client', message: errMsg })
        }
        setList([])
        return
      }
      const data = text ? (JSON.parse(text) as PendingItem[]) : []
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '네트워크 오류'
      if (msg.includes('abort')) {
        setListError({ kind: 'timeout' })
      } else {
        setListError({ kind: 'network', message: msg })
      }
      setList([])
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const handleRegister = async (productId: string) => {
    setRegisteringId(productId)
    setRegisteredMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationStatus: 'registered' }),
      })
      if (res.ok) {
        setList((prev) => prev.filter((p) => p.id !== productId))
        setRegisteredMessage('등록되었습니다. 상품 목록에서 확인하세요.')
        setSelectedId(null)
      }
    } catch {
      // fail
    } finally {
      setRegisteringId(null)
    }
  }

  const handleHold = async (productId: string) => {
    setHoldingId(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationStatus: 'on_hold' }),
      })
      if (res.ok) {
        setList((prev) => prev.filter((p) => p.id !== productId))
        setSelectedId(null)
      }
    } finally {
      setHoldingId(null)
    }
  }

  const handleReject = async (productId: string, reason?: string) => {
    setRejectingId(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationStatus: 'rejected',
          rejectReason: reason?.trim() || null,
        }),
      })
      if (res.ok) {
        setList((prev) => prev.filter((p) => p.id !== productId))
        setSelectedId(null)
      } else {
        const json = await res.json().catch(() => ({}))
        alert((json as { error?: string }).error ?? '반려 처리에 실패했습니다.')
      }
    } finally {
      setRejectingId(null)
    }
  }

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return s
    }
  }

  const imageNeededCount = list.filter((p) => !p.photosReady).length

  return (
    <div className="min-h-screen bg-bt-page p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-bt-meta hover:text-bt-link">
            ← 대시보드
          </Link>
          <Link href="/admin/products" className="text-sm text-bt-meta hover:text-bt-link">
            상품 목록
          </Link>
        </div>
        <AdminPageHeader
          title="등록대기"
          subtitle="이미지 수급·2차 분류 확인 후 승인하면 상품 목록에 노출됩니다. 좌측에서 상품을 선택해 검수하세요."
        />
        {registeredMessage && (
          <div className="mb-6 rounded-xl border border-bt-success bg-bt-badge-domestic p-4">
            <p className="text-sm font-medium text-bt-badge-domestic-text">{registeredMessage}</p>
            <Link
              href="/admin/products"
              className="mt-3 inline-block rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
            >
              상품 목록으로 이동
            </Link>
          </div>
        )}

        {/* KPI 카드: 등록대기 건수, 이미지 필요 건수, 승인 가능 건수 */}
        {!loading && !listError && (
          <section className="mb-8 grid gap-4 sm:grid-cols-3">
            <AdminKpiCard label="등록대기" value={`${list.length}건`} tone={list.length === 0 ? 'muted' : 'default'} />
            <AdminKpiCard label="이미지 필요" value={`${imageNeededCount}건`} tone="muted" />
            <AdminKpiCard label="승인 가능" value={`${list.length}건`} tone="muted" />
          </section>
        )}

        {loading ? (
          <div className="rounded-xl border border-bt-border-soft bg-bt-surface py-12 text-center text-bt-meta">
            로딩 중…
          </div>
        ) : listError ? (
          <div
            className={`rounded-xl border bg-bt-surface px-6 py-10 ${
              listError.kind === 'unauthorized' || listError.kind === 'forbidden'
                ? 'border-bt-border-strong'
                : listError.kind === 'server'
                  ? 'border-bt-danger'
                  : 'border-bt-warning'
            }`}
          >
            {listError.kind === 'unauthorized' && (
              <div className="mx-auto max-w-lg text-center">
                <p className="text-base font-semibold text-bt-title">
                  관리자 인증이 필요해 등록대기 목록을 불러오지 못했습니다.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-bt-body">
                  이 페이지는 열려 있어도, 목록 API는{' '}
                  <strong className="font-medium text-bt-strong">관리자 로그인(세션)</strong> 후에만 사용할 수
                  있습니다. 개발용 주소 바이패스(<code className="rounded bg-bt-surface-alt px-1 text-bt-body">?auth=</code>)는 페이지
                  진입에만 해당하며 API 인증을 대신하지 않습니다.
                </p>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/auth/signin?callbackUrl=/admin/pending"
                    className="inline-block rounded-lg bg-bt-cta-primary px-5 py-2.5 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
                  >
                    관리자로 로그인
                  </Link>
                  <button
                    type="button"
                    onClick={() => fetchPending()}
                    className="text-sm text-bt-muted underline decoration-bt-border-strong hover:text-bt-link"
                  >
                    다시 불러오기
                  </button>
                </div>
              </div>
            )}
            {listError.kind === 'forbidden' && (
              <div className="mx-auto max-w-lg text-center">
                <p className="text-base font-semibold text-bt-title">이 목록을 볼 권한이 없습니다.</p>
                <p className="mt-3 text-sm text-bt-body">
                  관리자 역할이 있는 계정으로 로그인했는지 확인해 주세요.
                </p>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/auth/signin?callbackUrl=/admin/pending"
                    className="inline-block rounded-lg bg-bt-cta-primary px-5 py-2.5 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
                  >
                    다른 계정으로 로그인
                  </Link>
                  <button
                    type="button"
                    onClick={() => fetchPending()}
                    className="text-sm text-bt-muted underline decoration-bt-border-strong hover:text-bt-link"
                  >
                    다시 불러오기
                  </button>
                </div>
              </div>
            )}
            {listError.kind === 'server' && (
              <div className="text-center">
                <p className="text-sm font-medium text-bt-danger">서버 오류로 목록을 불러오지 못했습니다.</p>
                <p className="mt-2 text-xs text-bt-danger">({listError.status}) {listError.message}</p>
                <button
                  type="button"
                  onClick={() => fetchPending()}
                  className="mt-4 rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
                >
                  다시 불러오기
                </button>
              </div>
            )}
            {(listError.kind === 'client' || listError.kind === 'network' || listError.kind === 'timeout') && (
              <div className="text-center">
                <p className="text-bt-warning">
                  {listError.kind === 'timeout'
                    ? '요청 시간이 초과되었습니다.'
                    : listError.kind === 'network'
                      ? `네트워크 오류: ${listError.message}`
                      : listError.message}
                </p>
                <button
                  type="button"
                  onClick={() => fetchPending()}
                  className="mt-4 rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover"
                >
                  다시 불러오기
                </button>
              </div>
            )}
          </div>
        ) : list.length === 0 ? (
          <AdminEmptyState
            title="등록대기 상품이 없습니다"
            description="상품 등록에서 텍스트를 붙여넣어 먼저 상품을 추가해 보세요."
            actionLabel="상품 등록"
            actionHref="/admin/register"
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
            {/* 좌측: 등록대기 리스트 */}
            <div className="min-w-0 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
              <ul className="space-y-2">
                {list.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                        selectedId === item.id
                          ? 'border-bt-brand-blue-strong bg-bt-brand-blue-soft'
                          : 'border-bt-border-soft bg-bt-surface hover:border-bt-border-strong hover:bg-bt-surface-soft'
                      }`}
                    >
                      <p className="truncate font-medium text-bt-title">{item.title}</p>
                      <p className="mt-0.5 text-xs text-bt-meta">
                        {item.originCode} · {formatOriginSourceForDisplay(item.originSource)}
                        {item.destination && ` · ${item.destination}`}
                      </p>
                      {(item.primaryRegion ?? item.displayCategory) && (
                        <p className="mt-1 text-xs text-bt-meta">
                          {[item.primaryRegion, item.displayCategory].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="mt-1.5 flex items-center gap-2">
                        <AdminStatusBadge
                          variant={item.photosReady ? 'registered' : 'pending_image'}
                          label={item.photosReady ? '사진 완료' : '이미지 수급'}
                        />
                        <Link
                          href={`/admin/products/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-bt-meta hover:text-bt-link"
                        >
                          상세 페이지 →
                        </Link>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 우측: 검수 패널 (상품 요약 + 이미지 수급 + 2차 분류 + 승인/보류/반려) */}
            <div className="min-w-0 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
              <AdminPendingDetailPanel
                productId={selectedId}
                listItem={selectedId ? list.find((p) => p.id === selectedId) ?? null : null}
                onApproved={handleRegister}
                onHold={handleHold}
                onReject={handleReject}
                onClearSelection={() => setSelectedId(null)}
                isRegistering={registeringId !== null}
                isHolding={holdingId !== null}
                isRejecting={rejectingId !== null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
