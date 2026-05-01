'use client'

import { useEffect } from 'react'

const ALLOWED_SELECTORS =
  'input, textarea, select, [contenteditable="true"], .allow-user-select'

function isAllowedInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(ALLOWED_SELECTORS) != null
}

function isBlockedShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.repeat || e.isComposing) return false

  if (e.key === 'F12') return true

  const mod = e.ctrlKey || e.metaKey
  if (!mod) return false

  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()

  if (k === 'u' || k === 's' || k === 'p') return true

  if (e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) return true

  if (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c')) return true

  return false
}

/** Heuristic: docked DevTools shrinks inner viewport vs outer window. */
function looksLikeDevToolsOpen(): boolean {
  if (typeof window === 'undefined') return false
  const wGap = window.outerWidth - window.innerWidth
  const hGap = window.outerHeight - window.innerHeight
  return wGap > 200 || hGap > 280
}

export function useAntiCopyProtection(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    const onContextMenu = (e: MouseEvent) => {
      if (!isAllowedInteractionTarget(e.target)) e.preventDefault()
    }

    const onSelectStart = (e: Event) => {
      if (!isAllowedInteractionTarget(e.target)) e.preventDefault()
    }

    const onDragStart = (e: DragEvent) => {
      if (!isAllowedInteractionTarget(e.target)) e.preventDefault()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isBlockedShortcut(e)) e.preventDefault()
    }

    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('selectstart', onSelectStart)
    document.addEventListener('dragstart', onDragStart)
    document.addEventListener('keydown', onKeyDown, true)

    let consecutiveHits = 0
    let armed = false
    let clearId: number | null = null
    let warnId: number | null = null

    const pollId: number = window.setInterval(() => {
      if (looksLikeDevToolsOpen()) {
        consecutiveHits += 1
        if (consecutiveHits >= 2 && !armed) {
          armed = true
          clearId = window.setInterval(() => {
            try {
              console.clear()
            } catch {
              /* ignore */
            }
          }, 350)
          warnId = window.setInterval(() => {
            try {
              console.warn('[BongTour] 개발자 도구 사용이 감지되었습니다.')
            } catch {
              /* ignore */
            }
          }, 4000)
        }
      } else {
        consecutiveHits = 0
        if (armed) {
          armed = false
          if (clearId != null) {
            window.clearInterval(clearId)
            clearId = null
          }
          if (warnId != null) {
            window.clearInterval(warnId)
            warnId = null
          }
        }
      }
    }, 600)

    return () => {
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('selectstart', onSelectStart)
      document.removeEventListener('dragstart', onDragStart)
      document.removeEventListener('keydown', onKeyDown, true)
      window.clearInterval(pollId)
      if (clearId != null) window.clearInterval(clearId)
      if (warnId != null) window.clearInterval(warnId)
    }
  }, [enabled])
}
