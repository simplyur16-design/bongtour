'use client'

import { useCallback, useEffect, useState } from 'react'
import { displayAccountStatus } from '@/lib/account-status'
import { displaySignupMethod } from '@/lib/signup-method'
import { displayRole, isSuperAdminRole } from '@/lib/user-role'
import { ACCOUNT_STATUSES } from '@/lib/account-status'

type Row = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string | null
  signupMethod: string | null
  socialProvider: string | null
  socialProviderUserId: string | null
  accountStatus: string
  privacyNoticeConfirmedAt: string | null
  privacyNoticeVersion: string | null
  marketingConsent: boolean
  marketingConsentAt: string | null
  marketingConsentVersion: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  _count: { accounts: number }
}

type ListState = 'loading' | 'ready' | 'forbidden' | 'error'

type Props = { actorRole: string | null | undefined }

export default function MembersAdminClient({ actorRole }: Props) {
  const canEdit = actorRole === 'ADMIN' || actorRole === 'SUPER_ADMIN'
  const superActor = isSuperAdminRole(actorRole)

  const [q, setQ] = useState('')
  const [signupMethod, setSignupMethod] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows] = useState<Row[]>([])
  const [listState, setListState] = useState<ListState>('loading')
  const [err, setErr] = useState('')
  const [saveHint, setSaveHint] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setListState('loading')
    setErr('')
    setSaveHint('')
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (signupMethod !== 'all') sp.set('signupMethod', signupMethod)
    if (roleFilter !== 'all') sp.set('role', roleFilter)
    if (statusFilter !== 'all') sp.set('accountStatus', statusFilter)
    try {
      const res = await fetch(`/api/admin/members?${sp.toString()}`)
      let data: { users?: Row[]; error?: string } = {}
      try {
        data = (await res.json()) as { users?: Row[]; error?: string }
      } catch {
        data = {}
      }
      if (res.status === 403) {
        setRows([])
        setListState('forbidden')
        return
      }
      if (!res.ok) {
        setRows([])
        setListState('error')
        setErr(data.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      setRows(data.users ?? [])
      setListState('ready')
    } catch {
      setRows([])
      setListState('error')
      setErr('네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.')
    }
  }, [q, signupMethod, roleFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function patchRow(id: string, body: { role?: string | null; accountStatus?: string }) {
    setSavingId(id)
    setSaveHint('')
    setErr('')
    try {
      const res = await fetch(`/api/admin/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      let data: { error?: string } = {}
      try {
        data = (await res.json()) as { error?: string }
      } catch {
        data = {}
      }
      if (res.status === 403) {
        setSaveHint(
          '저장은 관리자 권한이 연결된 뒤 가능합니다. 지금은 화면만 임시로 열려 있을 수 있습니다.'
        )
        return
      }
      if (!res.ok) {
        setErr(data.error ?? '저장에 실패했습니다.')
        return
      }
      await load()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  function roleSelectOptions(): { value: string; label: string }[] {
    const base = [
      { value: '', label: '일반' },
      { value: 'STAFF', label: '스태프' },
      { value: 'ADMIN', label: '관리자' },
    ]
    if (superActor) {
      base.push({ value: 'SUPER_ADMIN', label: '최고관리자' })
    }
    return base
  }

  return (
    <div className="px-4 pb-12 text-slate-100">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-amber-500/45 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">
          임시 공개 화면
        </span>
        <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800/90 px-3 py-1 text-xs text-slate-300">
          관리 기능 일부 비활성화
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">회원 관리</h1>
        <p className="mt-1 text-sm text-slate-400">
          가입 방식·역할·계정 상태를 확인합니다. 역할·상태 변경은 관리자 이상만 가능합니다.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-900/80 p-4">
        <label className="text-xs text-slate-400">
          검색
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·이메일"
            className="ml-2 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          가입 방식
          <select
            value={signupMethod}
            onChange={(e) => setSignupMethod(e.target.value)}
            className="ml-2 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          >
            <option value="all">전체</option>
            <option value="email">이메일</option>
            <option value="kakao">카카오</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">
          역할
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="ml-2 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          >
            <option value="all">전체</option>
            <option value="user">일반 회원</option>
            <option value="STAFF">스태프</option>
            <option value="admin">관리자(최고 포함)</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">
          상태
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-white"
          >
            <option value="all">전체</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {displayAccountStatus(s)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          disabled={listState === 'loading'}
        >
          적용
        </button>
      </div>

      {listState === 'forbidden' ? (
        <div className="mb-4 rounded-lg border border-sky-500/35 bg-sky-950/40 px-4 py-3 text-sm leading-relaxed text-sky-100">
          <p className="font-medium text-sky-50">회원 목록 데이터는 관리자 권한이 연결된 뒤 활성화됩니다.</p>
          <p className="mt-2 text-sky-200/90">
            지금은 페이지 구조만 임시 공개 상태입니다. 개인정보·권한이 포함될 수 있는 API는 의도적으로 제한될 수 있습니다.
          </p>
        </div>
      ) : null}

      {err ? (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{err}</div>
      ) : null}

      {saveHint ? (
        <div className="mb-3 rounded-lg border border-sky-500/35 bg-sky-950/30 px-3 py-2 text-sm text-sky-100">{saveHint}</div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-300">이름</th>
              <th className="px-3 py-2 font-medium text-slate-300">이메일</th>
              <th className="px-3 py-2 font-medium text-slate-300">가입 방식</th>
              <th className="px-3 py-2 font-medium text-slate-300">역할</th>
              <th className="px-3 py-2 font-medium text-slate-300">상태</th>
              <th className="px-3 py-2 font-medium text-slate-300">개인정보 안내 확인</th>
              <th className="px-3 py-2 font-medium text-slate-300">마케팅 동의</th>
              <th className="px-3 py-2 font-medium text-slate-300">가입일</th>
              <th className="px-3 py-2 font-medium text-slate-300">최근 로그인</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/50">
            {listState === 'loading' ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  불러오는 중…
                </td>
              </tr>
            ) : listState === 'forbidden' ? (
              <tr>
                <td colSpan={9} className="p-4 align-top">
                  <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 px-6 py-10 text-center">
                    <p className="text-sm font-medium text-slate-200">회원 목록은 아직 표시되지 않습니다</p>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
                      관리자 계정·역할이 시스템에 연결되면 이 영역에서 회원 정보를 조회할 수 있습니다. 오류가 아니라 접근 정책에 따른 상태일 수
                      있습니다.
                    </p>
                  </div>
                </td>
              </tr>
            ) : listState === 'error' ? (
              <tr>
                <td colSpan={9} className="p-4 align-top">
                  <div className="rounded-xl border border-dashed border-red-500/30 bg-red-950/20 px-6 py-8 text-center text-sm text-red-200/90">
                    위 안내를 확인한 뒤 「적용」으로 다시 불러오거나, 문제가 계속되면 시스템 관리자에게 문의해 주세요.
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  조건에 맞는 회원이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/80">
                  <td className="px-3 py-2 text-white">{r.name ?? '—'}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-300" title={r.email ?? ''}>
                    {r.email ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {displaySignupMethod(r.signupMethod)}
                    {r.socialProvider && r.socialProvider !== r.signupMethod ? (
                      <span className="block text-[10px] text-slate-500">@{r.socialProvider}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit && (superActor || r.role !== 'SUPER_ADMIN') ? (
                      <select
                        disabled={savingId === r.id}
                        value={r.role ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          void patchRow(r.id, { role: v === '' ? null : v })
                        }}
                        className="max-w-[9rem] rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-white"
                      >
                        {roleSelectOptions().map((o) => (
                          <option key={o.value || 'user'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-300">{displayRole(r.role)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit && (superActor || r.role !== 'SUPER_ADMIN') ? (
                      <select
                        disabled={savingId === r.id}
                        value={r.accountStatus}
                        onChange={(e) => void patchRow(r.id, { accountStatus: e.target.value })}
                        className="rounded border border-slate-600 bg-slate-900 px-1 py-1 text-xs text-white"
                      >
                        {ACCOUNT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {displayAccountStatus(s)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-300">{displayAccountStatus(r.accountStatus)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                    {r.privacyNoticeConfirmedAt ? '확인' : '미확인'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">
                    {r.marketingConsent ? '동의' : '미동의'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                    {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleString('ko-KR') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!canEdit ? (
        <p className="mt-4 text-xs text-slate-500">스태프 권한은 조회만 가능합니다.</p>
      ) : null}
    </div>
  )
}
