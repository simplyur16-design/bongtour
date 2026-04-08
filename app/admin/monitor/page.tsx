'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

type LogEvent = { t: 'log'; msg: string }
type ResultRow = {
  date: string
  priceAdult: number
  priceChildWithBed?: number | null
  priceChildNoBed?: number | null
  priceInfant?: number | null
  status: string
}
type ResultEvent = { t: 'result'; rows: ResultRow[] }
type ErrorEvent = { t: 'error'; msg: string; screenshot?: string }

type StreamEvent = LogEvent | ResultEvent | ErrorEvent

type ScrapeReport = {
  id: number
  productId: number | null
  step: string
  message: string
  screenshotPath: string | null
  resolved: boolean
  createdAt: string
}

function parseEvent(line: string): StreamEvent | null {
  try {
    return JSON.parse(line) as StreamEvent
  } catch {
    return null
  }
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
  const [mainUrl, setMainUrl] = useState('https://www.hanatour.com')
  const [countryName, setCountryName] = useState('')
  const [productCodeOrTitle, setProductCodeOrTitle] = useState('')
  const [productId, setProductId] = useState('')
  const [targetDate, setTargetDate] = useState(todayString)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [resultRows, setResultRows] = useState<ResultRow[]>([])
  const [sixtyDayRows, setSixtyDayRows] = useState<SixtyDayRow[]>([])
  const [loading60, setLoading60] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null)
  const [reports, setReports] = useState<ScrapeReport[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running) {
      fetch('/api/agent/reports')
        .then((r) => r.json())
        .then(setReports)
        .catch(() => {})
    }
  }, [running])

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const runScrape = async () => {
    setRunning(true)
    setLogs([])
    setResultRows([])
    setErrorMsg(null)
    setScreenshotPath(null)

    const pid = productId.trim() ? parseInt(productId, 10) : undefined
    const res = await fetch('/api/agent/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mainUrl: mainUrl.trim() || undefined,
        countryName: countryName.trim() || undefined,
        productCodeOrTitle: productCodeOrTitle.trim() || undefined,
        productId: Number.isNaN(pid) ? undefined : pid,
      }),
    })

    if (!res.body) {
      setErrorMsg('스트림을 받을 수 없습니다.')
      setRunning(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const event = parseEvent(line)
          if (!event) continue
          if (event.t === 'log') {
            setLogs((prev) => [...prev, event.msg])
            scrollToBottom()
          } else if (event.t === 'result') {
            setResultRows(event.rows)
          } else if (event.t === 'error') {
            setErrorMsg(event.msg)
            if (event.screenshot) setScreenshotPath(event.screenshot)
          }
        }
      }
      if (buffer.trim()) {
        const event = parseEvent(buffer)
        if (event) {
          if (event.t === 'log') setLogs((prev) => [...prev, event.msg])
          else if (event.t === 'result') setResultRows(event.rows)
          else if (event.t === 'error') {
            setErrorMsg(event.msg)
            if (event.screenshot) setScreenshotPath(event.screenshot)
          }
        }
      }
    } finally {
      setRunning(false)
    }
  }

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

  const display60Rows: SixtyDayRow[] =
    sixtyDayRows.length > 0
      ? sixtyDayRows
      : (() => {
          const start = new Date(targetDate)
          start.setDate(start.getDate() - 30)
          const end = new Date(targetDate)
          end.setDate(end.getDate() + 30)
          const startStr = start.toISOString().slice(0, 10)
          const endStr = end.toISOString().slice(0, 10)
          return resultRows
            .filter((r) => r.date >= startStr && r.date <= endStr)
            .map((r) => ({
              date: r.date,
              priceAdult: r.priceAdult,
              priceGap: null,
              status: r.status,
              priceChildWithBed: r.priceChildWithBed ?? null,
              priceChildNoBed: r.priceChildNoBed ?? null,
              priceInfant: r.priceInfant ?? null,
            }))
        })()

  const sorted60 = [...display60Rows].sort((a, b) => a.date.localeCompare(b.date))
  const previousPrices60 = new Map<string, number>()
  for (let i = 1; i < sorted60.length; i++) {
    previousPrices60.set(sorted60[i].date, sorted60[i - 1].priceAdult)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b-2 border-[#0F172A] pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">휴먼 시뮬레이션 가격 추적</h1>
          <p className="mt-1 text-sm text-[#0F172A]/80">브라우저 자동화 · 지능형 경로 · 달력 수확</p>
          <Link
            href="/admin"
            className="mt-3 inline-block text-sm font-medium text-[#0F172A] underline hover:no-underline"
          >
            관리자 센터로 돌아가기
          </Link>
        </header>

        <section className="mb-8 border border-[#0F172A]/20 bg-white p-6">
          <h2 className="mb-4 border-l-4 border-[#0F172A] pl-3 text-lg font-bold text-[#0F172A]">스크래핑 설정</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#0F172A]/70">
                메인 URL
              </label>
              <input
                type="url"
                value={mainUrl}
                onChange={(e) => setMainUrl(e.target.value)}
                className="w-full border border-[#0F172A]/30 px-3 py-2 text-sm text-[#0F172A]"
                placeholder="https://www.hanatour.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#0F172A]/70">
                국가명 (선택)
              </label>
              <input
                type="text"
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                className="w-full border border-[#0F172A]/30 px-3 py-2 text-sm text-[#0F172A]"
                placeholder="일본, 동남아"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#0F172A]/70">
                상품코드 또는 제목 (선택)
              </label>
              <input
                type="text"
                value={productCodeOrTitle}
                onChange={(e) => setProductCodeOrTitle(e.target.value)}
                className="w-full border border-[#0F172A]/30 px-3 py-2 text-sm text-[#0F172A]"
                placeholder="HPGR, 상품명 일부"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#0F172A]/70">
                DB 상품 ID (가격 저장용)
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
          </div>
          <button
            type="button"
            onClick={runScrape}
            disabled={running}
            className="mt-6 w-full border-2 border-[#0F172A] bg-[#0F172A] py-3 text-base font-bold text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            {running ? '추적 중…' : '스크래핑 시작'}
          </button>
        </section>

        <section className="mb-8 border border-[#0F172A]/20 bg-white p-6">
          <h2 className="mb-4 border-l-4 border-[#0F172A] pl-3 text-lg font-bold text-[#0F172A]">
            실시간 터미널
          </h2>
          <div
            className="max-h-[320px] overflow-y-auto border border-[#0F172A]/20 bg-[#0F172A]/5 p-4 font-mono text-sm"
            style={{ background: '#F8FAFC' }}
          >
            {logs.length === 0 && !errorMsg && !running && (
              <p className="text-[#0F172A]/50">시작 버튼을 누르면 로그가 여기 표시됩니다.</p>
            )}
            {logs.map((msg, i) => {
              const isSuccess = /성공|완료|완료\.|추출|반영/.test(msg)
              return (
                <div
                  key={i}
                  className={
                    isSuccess
                      ? 'font-bold leading-relaxed text-[#10B981]'
                      : 'leading-relaxed text-[#0F172A]'
                  }
                >
                  {msg}
                </div>
              )
            })}
            {errorMsg && (
              <div className="mt-2 font-bold text-[#EF4444]">{errorMsg}</div>
            )}
            {screenshotPath && (
              <p className="mt-2 text-sm text-[#0F172A]/70">
                스크린샷: <a href={screenshotPath} target="_blank" rel="noopener noreferrer" className="underline">{screenshotPath}</a>
              </p>
            )}
            {resultRows.length > 0 && (
              <div className="mt-3 font-bold text-[#10B981]">작업 성공 · 수확 {resultRows.length}건</div>
            )}
            <div ref={logEndRef} />
          </div>
        </section>

        {reports.length > 0 && (
          <section className="mb-8 border border-[#0F172A]/20 bg-white p-6">
            <h2 className="mb-4 border-l-4 border-[#EF4444] pl-3 text-lg font-bold text-[#0F172A]">
              경로 이탈: 여행사 UI 변경 감지
            </h2>
            <p className="mb-4 text-sm text-[#0F172A]/70">버튼 식별 실패 시 생성된 보고서입니다. 스크린샷으로 화면을 확인하세요.</p>
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
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#0F172A]">선택일</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="border border-[#0F172A]/30 px-2 py-1.5 text-sm text-[#0F172A]"
              />
            </label>
            <button
              type="button"
              onClick={load60Day}
              disabled={loading60 || !productId.trim()}
              className="border border-[#0F172A] bg-[#0F172A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1e293b] disabled:opacity-50"
            >
              {loading60 ? '불러오는 중…' : '60일 시세 불러오기'}
            </button>
          </div>
          {display60Rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#0F172A]/50">
              DB 상품 ID를 입력한 뒤 [60일 시세 불러오기]를 누르거나, 스크래핑 후 선택일 기준 60일 구간이 있으면 여기 표시됩니다.
            </p>
          ) : (
            <SixtyDayList
              rows={display60Rows}
              targetDate={targetDate}
              previousPrices={previousPrices60}
            />
          )}
        </section>
      </div>
    </div>
  )
}
