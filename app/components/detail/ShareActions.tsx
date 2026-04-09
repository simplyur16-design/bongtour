'use client'

import { useCallback, useEffect, useState } from 'react'

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
 * 모바일: Web Share API → OS 공유 시트(카카오톡·문자 등 선택).
 * 미지원·실패: 상품 요약 전체를 클립보드에 복사.
 */
export default function ShareActions({ title, summaryLine, className = '' }: Props) {
  const [pageUrl, setPageUrl] = useState('')
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    setPageUrl(typeof window !== 'undefined' ? window.location.href : '')
  }, [])

  const resolveUrl = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.href) return window.location.href
    return pageUrl
  }, [pageUrl])

  const flashHint = useCallback((msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 2600)
  }, [])

  const share = async () => {
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
        return
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        if (name === 'AbortError') return
      }
    }
    const ok = await copyTextToClipboard(fullText)
    if (ok) {
      flashHint('기기 공유를 쓸 수 없어 상품 요약을 복사했습니다. 원하는 앱에 붙여넣기 하세요.')
    } else {
      window.prompt('아래 내용을 복사해 공유해 주세요:', fullText)
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={share} className="w-full bt-btn-secondary min-h-[40px] text-[13px] font-medium">
        공유하기
      </button>
      {hint ? (
        <p className="mt-1.5 text-center text-[11px] font-medium text-bt-card-accent-strong" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
