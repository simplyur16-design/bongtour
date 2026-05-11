'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

/**
 * Bong투어 브랜드 스플래시 화면.
 *
 * 슬로건 SSOT — "simply your" (소문자, 띄어쓰기, 메모리 #13).
 * 로고는 헤더 SSOT(`/images/bongtour-logo.webp`) 재사용 — 첫 페이지 로드 시 같은 자산이라 캐시 hit.
 *
 * 타이밍 (총 2000ms):
 *   0    ~ 300ms   페이드인 (opacity 0→1, scale 0.95→1)
 *   300  ~ 1600ms  hold (정적 표시)
 *   1600 ~ 2000ms  페이드아웃 (opacity 1→0, 400ms)
 *
 * 세션당 1회만 노출 (`sessionStorage` `bt-splash-seen-v1`). 재방문/같은 탭 이동 시 즉시 스킵.
 *
 * 배경: 베이지(#F6EEDA) — `<body class="bg-beige">` 와 동일색이라 페이드아웃 시 끊김 0.
 */

const SESSION_KEY = 'bt-splash-seen-v1'
const FADE_IN_MS = 300
const HOLD_MS = 1300
const FADE_OUT_MS = 400
const TOTAL = FADE_IN_MS + HOLD_MS + FADE_OUT_MS // 2000

type Phase = 'pending' | 'in' | 'hold' | 'out'

/** phase 별 시각 상태 + transition. `pending` 은 transition 없이 시작 상태로만 박힌다(첫 paint 깜빡임 방지). */
function visualStyle(phase: Phase): React.CSSProperties {
  switch (phase) {
    case 'pending':
      return { opacity: 0, transform: 'scale(0.95)' }
    case 'in':
    case 'hold':
      return {
        opacity: 1,
        transform: 'scale(1)',
        transition: `opacity ${FADE_IN_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out`,
      }
    case 'out':
      return {
        opacity: 0,
        transform: 'scale(1)',
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        pointerEvents: 'none',
      }
  }
}

export function BongtourSplash() {
  // sessionStorage 체크 전까지 null → hydration mismatch 방지
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(true)
  const [phase, setPhase] = useState<Phase>('pending')

  useEffect(() => {
    setMounted(true)
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_KEY)) {
        setVisible(false)
        return
      }
    } catch {
      /* private mode 등 — 매번 노출 */
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    /** 한 프레임 뒤(16ms) 에 'in' 으로 전환해야 React 가 'pending' opacity-0 → 'in' opacity-1 transition 을 trigger 한다. */
    timers.push(setTimeout(() => setPhase('in'), 16))
    timers.push(setTimeout(() => setPhase('hold'), 16 + FADE_IN_MS))
    timers.push(setTimeout(() => setPhase('out'), 16 + FADE_IN_MS + HOLD_MS))
    timers.push(
      setTimeout(() => {
        setVisible(false)
        try {
          window.sessionStorage.setItem(SESSION_KEY, '1')
        } catch {
          /* ignore */
        }
      }, TOTAL),
    )

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  if (!mounted) return null
  if (!visible) return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: '#F6EEDA',
        ...visualStyle(phase),
      }}
    >
      <div
        className="flex flex-col items-center px-6"
        style={{ rowGap: 'clamp(0.5rem, 2vh, 1rem)' }}
      >
        <p
          className="m-0 select-none"
          style={{
            color: '#4FD1C5',
            fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)',
            letterSpacing: '0.15em',
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          simply your
        </p>
        <Image
          src="/images/bongtour-logo.webp"
          alt="Bong투어"
          width={274}
          height={78}
          priority
          sizes="(max-width: 640px) 80vw, 320px"
          className="h-auto select-none"
          style={{ width: 'min(80vw, 320px)' }}
        />
      </div>
    </div>
  )
}
