'use client'

import { useCallback, useEffect, useState } from 'react'
import { KAKAO_OPEN_CHAT_URL } from '@/lib/kakao-open-chat'

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

export default function ShareActions({ title, summaryLine, className = '' }: Props) {
  const [pageUrl, setPageUrl] = useState('')
  const [urlButtonCopied, setUrlButtonCopied] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    setPageUrl(typeof window !== 'undefined' ? window.location.href : '')
  }, [])

  /** effect 전에 클릭해도 동작하도록 항상 최신 location 사용 */
  const resolveUrl = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.href) return window.location.href
    return pageUrl
  }, [pageUrl])

  const flashHint = useCallback((msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint(null), 2200)
  }, [])

  const copyUrl = async () => {
    const targetUrl = resolveUrl()
    if (!targetUrl) {
      flashHint('주소를 확인할 수 없습니다.')
      return
    }
    const ok = await copyTextToClipboard(targetUrl)
    if (ok) {
      setUrlButtonCopied(true)
      window.setTimeout(() => setUrlButtonCopied(false), 2000)
      flashHint('현재 페이지 URL이 복사되었습니다.')
    } else {
      window.prompt('아래 URL을 복사해 주세요:', targetUrl)
    }
  }

  const webShare = async () => {
    const targetUrl = resolveUrl()
    if (!targetUrl) {
      flashHint('주소를 확인할 수 없습니다.')
      return
    }
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
    const ok = await copyTextToClipboard(targetUrl)
    if (ok) flashHint('Web Share를 쓸 수 없어 링크를 복사했습니다.')
    else window.prompt('공유할 링크를 복사해 주세요:', targetUrl)
  }

  const kakaoShare = async () => {
    const targetUrl = resolveUrl()
    if (!targetUrl) {
      flashHint('주소를 확인할 수 없습니다.')
      return
    }
    const msg = buildShareText(title, summaryLine, targetUrl)
    const copiedOk = await copyTextToClipboard(msg)
    if (copiedOk) flashHint('상품 요약이 복사되었습니다. 카카오 채팅에 붙여넣기 하세요.')
    else window.prompt('아래 내용을 복사해 카카오톡에 붙여넣기 하세요:', msg)
    window.open(KAKAO_OPEN_CHAT_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyUrl} className="bt-btn-ghost min-h-[34px] px-3 text-[11px]">
          {urlButtonCopied ? '복사됨' : 'URL 복사'}
        </button>
        <button type="button" onClick={webShare} className="bt-btn-secondary min-h-[34px] px-3 text-[11px]">
          공유
        </button>
        <button
          type="button"
          onClick={kakaoShare}
          className="bt-btn min-h-[34px] rounded-lg border border-[#e5d78a] bg-[#FFFBEB] px-3 text-[11px] font-bold text-[#191919] hover:bg-[#FFF8DC]"
        >
          카카오 공유하기
        </button>
      </div>
      {hint ? (
        <p className="mt-1.5 text-center text-[11px] font-medium text-bt-card-accent-strong" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
