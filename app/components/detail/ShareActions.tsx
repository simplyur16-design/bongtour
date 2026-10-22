'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

type Props = {
  title: string
  summaryLine: string
  className?: string
}

function buildShareText(title: string, summaryLine: string, url: string) {
  return [`[Bong투어 상품 공유]`, title, summaryLine, url].filter(Boolean).join('\n')
}

/** Clipboard API 실패·비보안 컨텍스트 등에서도 동작하도록 fallback */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * 공유하기 → 카카오톡 / URL 복사 선택.
 * 카카오톡: Web Share(시트에 카톡) → 미지원 시 요약 복사 후 붙여넣기 안내.
 * REGRESSION-FREEZE[product-detail-share-actions]: 카톡·URL 복사 메뉴 — manifest
 */
export default function ShareActions({ title, summaryLine, className = '' }: Props) {
  const [pageUrl, setPageUrl] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    setPageUrl(typeof window !== 'undefined' ? window.location.href : '')
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const resolveUrl = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.href) return window.location.href
    return pageUrl
  }, [pageUrl])

  const flashHint = useCallback((msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 2800)
  }, [])

  const shareViaKakao = async () => {
    const targetUrl = resolveUrl()
    if (!targetUrl) {
      flashHint('주소를 확인할 수 없습니다.')
      return
    }
    const fullText = buildShareText(title, summaryLine, targetUrl)
    const shareData: ShareData = { title, text: summaryLine, url: targetUrl }
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (typeof nav.share === 'function') {
      try {
        await nav.share(shareData)
        setOpen(false)
        return
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') {
          setOpen(false)
          return
        }
      }
    }
    const ok = await copyTextToClipboard(fullText)
    setOpen(false)
    if (ok) {
      flashHint('공유 문구를 복사했습니다. 카카오톡에 붙여넣기 하세요.')
    } else {
      window.prompt('아래 내용을 복사해 카카오톡에 붙여넣기 하세요:', fullText)
    }
  }

  const copyUrlOnly = async () => {
    const targetUrl = resolveUrl()
    if (!targetUrl) {
      flashHint('주소를 확인할 수 없습니다.')
      return
    }
    const ok = await copyTextToClipboard(targetUrl)
    setOpen(false)
    if (ok) {
      flashHint('상품 URL을 복사했습니다.')
    } else {
      window.prompt('아래 URL을 복사하세요:', targetUrl)
    }
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bt-btn-secondary min-h-[40px] text-[13px] font-medium"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
      >
        공유하기
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-bt-border bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void shareViaKakao()}
            className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-[13px] font-semibold text-bt-title transition hover:bg-[#FFF8E7]"
          >
            <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FEE500] text-[11px] font-black text-[#191919]">
              톡
            </span>
            카카오톡으로 공유
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void copyUrlOnly()}
            className="flex w-full items-center gap-2 border-t border-bt-border-soft px-3.5 py-3 text-left text-[13px] font-semibold text-bt-title transition hover:bg-bt-surface-muted"
          >
            <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-700">
              URL
            </span>
            URL 복사
          </button>
        </div>
      ) : null}
      {hint ? (
        <p className="mt-1.5 text-center text-[11px] font-medium text-bt-card-accent-strong" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
