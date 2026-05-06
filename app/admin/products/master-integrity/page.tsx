'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import Link from 'next/link'

type Report = {
  at: string
  counts: Record<string, number>
  sampleIds: Record<string, string[]>
  cardProductCounts: Array<{ cardKey: string; koreanLabel: string; productCount: number }>
}

export default function MasterIntegrityPage() {
  const [data, setData] = useState<Report | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [runBusy, setRunBusy] = useState(false)
  const [runMsg, setRunMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/admin/master-integrity', { credentials: 'include' })
      if (!r.ok) {
        setErr(`로드 실패 (${r.status})`)
        setData(null)
        return
      }
      setData((await r.json()) as Report)
    } catch {
      setErr('네트워크 오류')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runOnce(skipNotify: boolean) {
    setRunBusy(true)
    setRunMsg(null)
    try {
      const u = new URL('/api/admin/master-integrity', window.location.origin)
      u.searchParams.set('skipNotify', skipNotify ? '1' : '0')
      const r = await fetch(u.toString(), { method: 'POST', credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setRunMsg(`실행 실패 (${r.status})`)
        return
      }
      setRunMsg(
        skipNotify
          ? '검증 완료 (알림 생략). 목록을 새로고침했습니다.'
          : '검증 완료. 이상 건수가 있으면 Solapi 발송(또는 DRY_RUN 로그) 처리되었습니다.',
      )
      if (j.report) setData(j.report as Report)
      else await load()
    } catch {
      setRunMsg('네트워크 오류')
    } finally {
      setRunBusy(false)
    }
  }

  const c = data?.counts

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <AdminPageHeader
        title="마스터·메가메뉴 정합"
        subtitle="등록 완료 해외 상품의 마스터 FK·한글 라벨·태그 대표 일치 여부와 메가메뉴 카드별 상품 수를 점검합니다. 매일 03:00(KST) cron에서 동일 검증을 실행합니다."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={runBusy || loading}
          onClick={() => void load()}
          className="rounded-lg border border-bt-border bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          새로고침
        </button>
        <button
          type="button"
          disabled={runBusy}
          onClick={() => void runOnce(true)}
          className="rounded-lg bg-bt-brand-blue px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          지금 검증 (알림 생략)
        </button>
        <button
          type="button"
          disabled={runBusy}
          onClick={() => void runOnce(false)}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 disabled:opacity-50"
        >
          지금 검증 + 이상 시 Solapi
        </button>
        <Link
          href="/admin/products/geo-audit"
          className="inline-flex items-center rounded-lg border border-bt-border bg-white px-3 py-2 text-sm"
        >
          지리 검수 (F-1)
        </Link>
      </div>
      {runMsg && <p className="text-sm text-bt-body">{runMsg}</p>}
      {err && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}

      {loading && <p className="text-sm text-bt-muted">불러오는 중…</p>}

      {c && (
        <>
          <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-bt-title">요약 · {data?.at}</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-bt-muted">등록 완료 해외</dt>
                <dd className="font-mono">{c.registeredOverseas}</dd>
              </div>
              <div>
                <dt className="text-bt-muted">등록대기 해외</dt>
                <dd className="font-mono">{c.pendingOverseas}</dd>
              </div>
              <div>
                <dt className="text-bt-muted">정규화 이상(고유 상품)</dt>
                <dd className={`font-mono ${c.brokenTotal > 0 ? 'font-semibold text-amber-800' : ''}`}>
                  {c.brokenTotal}
                </dd>
              </div>
              <div>
                <dt className="text-bt-muted">무효 countryKey / continentKey / cityKey</dt>
                <dd className="font-mono text-xs">
                  {c.invalidCountryKeyRefs} / {c.invalidContinentKeyRefs} / {c.invalidCityKeyRefs}
                </dd>
              </div>
              <div>
                <dt className="text-bt-muted">라벨 불일치 country / city</dt>
                <dd className="font-mono">
                  {c.labelCountryMismatch} / {c.labelCityMismatch}
                </dd>
              </div>
              <div>
                <dt className="text-bt-muted">continentKey 누락(등록·해외)</dt>
                <dd className="font-mono">{c.nullContinentRegisteredOverseas}</dd>
              </div>
              <div>
                <dt className="text-bt-muted">태그 대표 불일치 country / city</dt>
                <dd className="font-mono">
                  {c.primaryCountryTagMismatch} / {c.primaryCityTagMismatch}
                </dd>
              </div>
            </dl>
          </div>

          {data?.sampleIds && Object.keys(data.sampleIds).length > 0 && (
            <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-bt-title">샘플 상품 id (카테고리별 최대 12건)</h2>
              <ul className="space-y-3 text-xs">
                {Object.entries(data.sampleIds).map(([k, ids]) =>
                  ids.length ? (
                    <li key={k}>
                      <span className="font-medium text-bt-title">{k}</span>
                      <div className="mt-1 font-mono text-bt-muted break-all">{ids.join(', ')}</div>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}

          {data?.cardProductCounts && data.cardProductCounts.length > 0 && (
            <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-bt-title">메가메뉴 카드별 노출 후보 상품 수</h2>
              <p className="mb-3 text-xs text-bt-muted">
                등록 완료 해외 상품 중, 대표 국가 또는 국가 태그가 카드 소속 국가에 포함되는 건수입니다.
              </p>
              <div className="max-h-[50vh] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-bt-border text-bt-muted">
                      <th className="py-2 pr-2">카드</th>
                      <th className="py-2 pr-2">cardKey</th>
                      <th className="py-2 text-right">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cardProductCounts.map((row) => (
                      <tr key={row.cardKey} className="border-b border-bt-border/60">
                        <td className="py-1.5 pr-2">{row.koreanLabel}</td>
                        <td className="py-1.5 pr-2 font-mono text-xs">{row.cardKey}</td>
                        <td className="py-1.5 text-right font-mono">{row.productCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
