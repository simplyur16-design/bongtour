'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'

type ScrapeReport = {
  id: number
  productId: number | null
  step: string
  message: string
  screenshotPath: string | null
  resolved: boolean
  createdAt: string
}

/** 60일 시세 세로 리스트: targetDate 중앙, 과거 30일·미래 30일. 성인가 전용 노출, 클릭 시 아동/유아. */
type SixtyDayRow = {
  date: string
  priceAdult: number
  priceGap?: number | null
  status: string
  priceChildWithBed?: number | null
  priceChildNoBed?: number | null
  priceInfant?: number | null
}

function SixtyDayRowItem({
  row,
  isTarget,
  displayGap,
}: {
  row: SixtyDayRow
  isTarget: boolean
  displayGap: number | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <li
      className={
        isTarget
          ? 'border-l-4 border-[#10B981] bg-slate-100 py-3 pl-4 pr-4'
          : 'py-2 pl-4 pr-4'
      }
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-medium text-[#0F172A]">{row.date}</span>
        <span className="tabular-nums text-[#0F172A]">
          {row.priceAdult.toLocaleString('ko-KR')}원
        </span>
        <span className="w-24 text-right tabular-nums">
          {displayGap != null && displayGap !== 0 ? (
            <span className={displayGap > 0 ? 'font-medium text-red-600' : 'font-medium text-[#10B981]'}>
              {displayGap > 0 ? '+' : ''}
              {displayGap.toLocaleString('ko-KR')}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </span>
        <span className="w-20 text-right text-sm text-[#0F172A]/70">{row.status}</span>
      </button>
      {open && (row.priceChildWithBed != null || row.priceChildNoBed != null || row.priceInfant != null) && (
        <div className="mt-2 border-t border-slate-200 pt-2 text-sm text-[#0F172A]/80">
          {row.priceChildWithBed != null && <p>아동(베드) {row.priceChildWithBed.toLocaleString('ko-KR')}원</p>}
          {row.priceChildNoBed != null && <p>아동(노베드) {row.priceChildNoBed.toLocaleString('ko-KR')}원</p>}
          {row.priceInfant != null && <p>유아 {row.priceInfant.toLocaleString('ko-KR')}원</p>}
        </div>
      )}
    </li>
  )
}

function SixtyDayList({
  rows,
  targetDate,
  previousPrices,
}: {
  rows: SixtyDayRow[]
  targetDate: string
  previousPrices: Map<string, number>
}) {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div className="border-l-4 border-slate-900">
      <p className="mb-3 pl-3 text-xs font-bold uppercase tracking-wider text-[#0F172A]/70">
        60일 시세 (성인가) · 선택일 기준 앞뒤 30일 · 날짜순
      </p>
      <div className="mb-2 flex border-b border-slate-200 py-2 pl-4 pr-4 text-xs font-bold uppercase tracking-wider text-[#0F172A]/70">
        <span className="flex-1">날짜</span>
        <span className="w-28 text-right">성인가</span>
        <span className="w-24 text-right">전일대비</span>
        <span className="w-20 text-right">상태</span>
      </div>
      <ul className="divide-y divide-slate-200">
        {sorted.map((r) => {
          const isTarget = r.date === targetDate
          const prevPrice = previousPrices.get(r.date)
          const displayGap =
            r.priceGap != null ? r.priceGap : prevPrice != null ? r.priceAdult - prevPrice : null
          return (
            <SixtyDayRowItem
              key={r.date}
              row={r}
              isTarget={isTarget}
              displayGap={displayGap}
            />
          )
        })}
      </ul>
    </div>
  )
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminMonitorPage() {
  const [productId, setProductId] = useState('')
  const [targetDate, setTargetDate] = useState(todayString)
  const [sixtyDayRows, setSixtyDayRows] = useState<SixtyDayRow[]>([])
  const [loading60, setLoading60] = useState(false)
  const [reports, setReports] = useState<ScrapeReport[]>([])

  useEffect(() => {
    fetch('/api/agent/reports')
      .then((r) => r.json())
      .then(setReports)
      .catch(() => {})
  }, [])

  const load60Day = useCallback(async () => {
    const pid = productId.trim() ? parseInt(productId, 10) : null
    if (!pid || Number.isNaN(pid)) return
    setLoading60(true)
    try {
      const res = await fetch(
        `/api/admin/products/${pid}/prices?targetDate=${encodeURIComponent(targetDate)}`
      )
      const data = await res.json()
      if (res.ok && Array.isArray(data.prices)) {
        setSixtyDayRows(data.prices)
      } else {
        setSixtyDayRows([])
      }
    } catch {
      setSixtyDayRows([])
    } finally {
      setLoading60(false)
    }
  }, [productId, targetDate])

  const sorted60 = [...sixtyDayRows].sort((a, b) => a.date.localeCompare(b.date))
  const previousPrices60 = new Map<string, number>()
  for (let i = 1; i < sorted60.length; i++) {
    previousPrices60.set(sorted60[i].date, sorted60[i - 1].priceAdult)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b-2 border-[#0F172A] pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">가격 관제</h1>
          <p className="mt-1 text-sm text-[#0F172A]/80">DB 저장 출발일·가격 60일 시세 조회</p>
          <Link
            href="/admin"
            className="mt-3 inline-block text-sm font-medium text-[#0F172A] underline hover:no-underline"
          >
            관리자 센터로 돌아가기
          </Link>
        </header>

        {reports.length > 0 && (
          <section className="mb-8 border border-[#0F172A]/20 bg-white p-6">
            <h2 className="mb-4 border-l-4 border-[#EF4444] pl-3 text-lg font-bold text-[#0F172A]">
              과거 경로 이탈 보고 (legacy)
            </h2>
            <p className="mb-4 text-sm text-[#0F172A]/70">이전 브라우저 에이전트 스크래퍼 기록입니다.</p>
            <ul className="space-y-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="border-l-4 border-[#0F172A] bg-[#F8FAFC] py-2 pl-4 pr-2"
                >
                  <p className="font-bold text-[#0F172A]">{r.message}</p>
                  <p className="mt-1 text-sm text-[#0F172A]/70">
                    단계: {r.step} · {new Date(r.createdAt).toLocaleString('ko-KR')}
                  </p>
                  {r.screenshotPath && (
                    <a
                      href={r.screenshotPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-[#0F172A] underline"
                    >
                      스크린샷 보기
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border border-[#0F172A]/20 bg-white p-6">
          <h2 className="mb-4 border-l-4 border-slate-900 pl-3 text-lg font-bold text-[#0F172A]">
            60일 시세 관제
          </h2>
          <p className="mb-4 text-sm text-[#0F172A]/70">
            고객 선택일(targetDate)을 중앙에 두고 과거 30일·미래 30일 데이터. 성인가만 기본 노출, 행 클릭 시 아동/유아.
          </p>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#0F172A]/70">
                DB 상품 ID
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full border border-[#0F172A]/30 px-3 py-2 text-sm text-[#0F172A]"
                placeholder="숫자"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#0F172A]/70">
                선택일
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full border border-[#0F172A]/30 px-2 py-2 text-sm text-[#0F172A]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={load60Day}
            disabled={loading60 || !productId.trim()}
            className="border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            {loading60 ? '불러오는 중…' : '60일 시세 불러오기'}
          </button>
          {sixtyDayRows.length === 0 ? (
            <p className="mt-8 py-8 text-center text-sm text-[#0F172A]/50">
              DB 상품 ID를 입력한 뒤 [60일 시세 불러오기]를 누르세요.
            </p>
          ) : (
            <div className="mt-8">
              <SixtyDayList
                rows={sixtyDayRows}
                targetDate={targetDate}
                previousPrices={previousPrices60}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
