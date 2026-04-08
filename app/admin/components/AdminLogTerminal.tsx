'use client'

import { useState, useEffect, useRef } from 'react'

type LogEntry = { level: string; text: string; ts: number }

function LogLine({ entry }: { entry: LogEntry }) {
  const color =
    entry.level === 'ERROR'
      ? 'text-red-400'
      : entry.level === 'WARN'
        ? 'text-amber-400'
        : 'text-emerald-400'
  return (
    <div className={`font-mono text-xs ${color}`}>
      <span className="select-none text-slate-500">› </span>
      {entry.text}
    </div>
  )
}

type Props = { onRunWithStream: () => void; runLoading: boolean }

export default function AdminLogTerminal({ onRunWithStream, runLoading }: Props) {
  const [lines, setLines] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let mounted = true

    const connect = () => {
      const es = new EventSource('/api/admin/logs/stream')
      eventSource = es
      es.onopen = () => mounted && setConnected(true)
      es.onerror = () => {
        if (mounted) setConnected(false)
        es.close()
      }
      es.onmessage = (e) => {
        if (!mounted) return
        const raw = e.data
        if (raw == null || String(raw).trim() === '') return
        try {
          const data = JSON.parse(raw) as LogEntry
          if (data?.text != null) {
            setLines((prev) => [...prev.slice(-1999), { level: data.level || 'INFO', text: data.text, ts: data.ts }])
          }
        } catch {
          // keepalive or invalid json
        }
      }
    }

    connect()
    return () => {
      mounted = false
      eventSource?.close()
    }
  }, [])

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines])

  return (
    <div className="flex h-[400px] min-h-[400px] flex-col rounded-xl border border-slate-800 bg-black">
      <div className="flex h-9 shrink-0 items-center justify-between rounded-t-xl border-b border-slate-800 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">실시간 로그</span>
          {connected && (
            <span className="h-2 w-2 rounded-full bg-emerald-500" title="연결됨" />
          )}
        </div>
        <button
          type="button"
          onClick={onRunWithStream}
          disabled={runLoading}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {runLoading ? '실행 중…' : '봇 실행 (스트리밍)'}
        </button>
      </div>
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-black p-4 font-mono"
      >
        {lines.length === 0 && !connected && (
          <p className="text-slate-600">[봇 실행 (스트리밍)]을 누르면 로그가 여기 실시간으로 표시됩니다.</p>
        )}
        {lines.length === 0 && connected && (
          <p className="text-slate-600">로그 대기 중…</p>
        )}
        {lines.map((entry, i) => (
          <LogLine key={`${entry.ts}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  )
}
