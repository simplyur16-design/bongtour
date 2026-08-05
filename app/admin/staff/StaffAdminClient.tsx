'use client'

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import { useCallback, useEffect, useState } from 'react'
import {
  ADMIN_BTN_PRIMARY_CLASS,
  ADMIN_BTN_SECONDARY_CLASS,
  ADMIN_CARD_CLASS,
  ADMIN_PAGE_SUBTITLE_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
  ADMIN_TABLE_WRAP_CLASS,
} from '@/lib/admin-design-system'
import { displayRole } from '@/lib/user-role'

type Row = {
  id: string
  name: string | null
  email: string | null
  role: string | null
  roleLabel: string
  accountStatus: string
  lastLoginAt: string | null
  createdAt: string
}

export default function StaffAdminClient() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [hint, setHint] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    setHint('')
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    try {
      const res = await fetch(`/api/admin/staff?${sp.toString()}`)
      const data = (await readAdminResponseJson(res).catch(() => ({}))) as { users?: Row[]; error?: string }
      if (!res.ok) {
        setRows([])
        setErr(data.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      setRows(data.users ?? [])
    } catch {
      setRows([])
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    void load()
  }, [load])

  async function setStaffRole(userId: string, role: 'STAFF' | null) {
    setSavingId(userId)
    setErr('')
    setHint('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      const data = (await readAdminResponseJson(res).catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? '저장에 실패했습니다.')
        return
      }
      setHint(role === 'STAFF' ? '스태프로 승격했습니다.' : '일반 회원으로 강등했습니다.')
      await load()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className={ADMIN_PAGE_TITLE_CLASS}>직원 권한 관리</h1>
      <p className={ADMIN_PAGE_SUBTITLE_CLASS}>
        일반 회원을 <strong>STAFF</strong>로 승격하면 공개 페이지 빠른 검색·문의 답변과
        관리자 화면의 <strong>소속 명함 승인</strong>·회원 조회를 사용할 수 있습니다.
        ADMIN만 이 화면과 STAFF 지정이 가능합니다.
      </p>

      <div className={`${ADMIN_CARD_CLASS} mt-6`}>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void load()
          }}
        >
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-bt-text-navy">이름·이메일 검색</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="example@bongtour.com"
              className="rounded-lg border border-bt-border-soft px-3 py-2"
            />
          </label>
          <button type="submit" className={ADMIN_BTN_PRIMARY_CLASS} disabled={loading}>
            검색
          </button>
        </form>
      </div>

      {err ? <p className="mt-4 text-sm text-rose-700">{err}</p> : null}
      {hint ? <p className="mt-4 text-sm text-emerald-800">{hint}</p> : null}

      <div className={`${ADMIN_TABLE_WRAP_CLASS} mt-6`}>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-bt-border-soft bg-bt-bg-lavender-soft/60 text-xs uppercase text-bt-text-muted-lavender">
            <tr>
              <th className="px-4 py-3">회원</th>
              <th className="px-4 py-3">역할</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-bt-text-muted-lavender">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-bt-text-muted-lavender">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const isStaff = u.role === 'STAFF'
                const busy = savingId === u.id
                return (
                  <tr key={u.id} className="border-b border-bt-border-soft/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-bt-text-navy">{u.name?.trim() || '(이름 없음)'}</div>
                      <div className="text-xs text-bt-text-muted-lavender">{u.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">{displayRole(u.role)}</td>
                    <td className="px-4 py-3">{u.accountStatus}</td>
                    <td className="px-4 py-3">
                      {isStaff ? (
                        <button
                          type="button"
                          disabled={busy}
                          className={ADMIN_BTN_SECONDARY_CLASS}
                          onClick={() => void setStaffRole(u.id, null)}
                        >
                          STAFF 해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          className={ADMIN_BTN_PRIMARY_CLASS}
                          onClick={() => void setStaffRole(u.id, 'STAFF')}
                        >
                          STAFF 승격
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
