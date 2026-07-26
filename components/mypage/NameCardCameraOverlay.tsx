'use client'

/**
 * 모바일 명함 촬영 — 뷰파인더 + ISO ID-1 비율 가이드 틀 + 확인/다시찍기.
 * REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: name-card camera frame — manifest
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** 명함 가로:세로 ≈ 85.6:53.98 */
const CARD_ASPECT = 85.6 / 53.98
const FRAME_WIDTH_RATIO = 0.88

type Props = {
  open: boolean
  onClose: () => void
  onCaptured: (file: File) => void
}

type Draft = {
  file: File
  previewUrl: string
}

export default function NameCardCameraOverlay({ open, onClose, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  const clearDraft = useCallback(() => {
    setDraft((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 기기에서는 카메라 촬영을 지원하지 않습니다. 사진 업로드를 이용해 주세요.')
      return
    }
    setError(null)
    setReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
        setReady(true)
      }
    } catch {
      setError('카메라 권한이 필요합니다. 설정에서 허용하거나 사진 업로드를 이용해 주세요.')
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      clearDraft()
      setError(null)
      return
    }
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await startCamera()
    })()
    return () => {
      cancelled = true
      stopStream()
      clearDraft()
    }
  }, [open, startCamera, stopStream, clearDraft])

  async function shoot() {
    const video = videoRef.current
    const frameEl = frameRef.current
    if (!video || !frameEl || !ready || shooting || draft) return
    setShooting(true)
    setError(null)
    try {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) {
        setError('카메라가 아직 준비되지 않았습니다.')
        return
      }

      const videoRect = video.getBoundingClientRect()
      const frameRect = frameEl.getBoundingClientRect()

      const scale = Math.max(videoRect.width / vw, videoRect.height / vh)
      const displayedW = vw * scale
      const displayedH = vh * scale
      const offsetX = (displayedW - videoRect.width) / 2
      const offsetY = (displayedH - videoRect.height) / 2

      const sx = Math.max(0, (frameRect.left - videoRect.left + offsetX) / scale)
      const sy = Math.max(0, (frameRect.top - videoRect.top + offsetY) / scale)
      const sw = Math.min(vw - sx, frameRect.width / scale)
      const sh = Math.min(vh - sy, frameRect.height / scale)

      const canvas = document.createElement('canvas')
      const outW = Math.round(Math.max(sw, 640))
      const outH = Math.round(outW / CARD_ASPECT)
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('촬영에 실패했습니다.')
        return
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      )
      if (!blob) {
        setError('이미지 저장에 실패했습니다.')
        return
      }
      const file = new File([blob], `name-card-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const previewUrl = URL.createObjectURL(blob)
      // 확인 단계에서는 미리보기만 — 카메라는 일시 정지(트랙은 유지하거나 정지 후 다시찍기 시 재시작)
      streamRef.current?.getTracks().forEach((t) => {
        t.enabled = false
      })
      setDraft({ file, previewUrl })
    } finally {
      setShooting(false)
    }
  }

  async function retake() {
    clearDraft()
    setError(null)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.enabled = true
      })
      const video = videoRef.current
      if (video && video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current
      }
      try {
        await videoRef.current?.play()
        setReady(true)
      } catch {
        stopStream()
        await startCamera()
      }
    } else {
      await startCamera()
    }
  }

  function confirmShot() {
    if (!draft) return
    const { file, previewUrl } = draft
    setDraft(null)
    URL.revokeObjectURL(previewUrl)
    onCaptured(file)
    onClose()
  }

  function handleClose() {
    clearDraft()
    onClose()
  }

  if (!open) return null

  const reviewing = Boolean(draft)

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        {/* 촬영 모드 비디오 — 확인 중에는 숨김 */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${reviewing ? 'invisible' : ''}`}
        />

        {reviewing && draft ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-4">
            <p className="mb-3 text-sm font-medium text-white">이 사진으로 할까요?</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.previewUrl}
              alt="촬영한 명함 확인"
              className="max-h-[55vh] w-full max-w-md rounded-lg border-2 border-white/80 object-contain bg-black"
            />
            <p className="mt-3 text-center text-xs text-white/70">글자가 선명한지 확인해 주세요</p>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4">
            <p className="mb-3 rounded-full bg-black/55 px-3 py-1 text-center text-xs font-medium text-white">
              명함을 흰 틀 안에 맞춰 주세요
            </p>
            <div
              ref={frameRef}
              className="relative rounded-md"
              style={{ aspectRatio: `${CARD_ASPECT}`, width: `${FRAME_WIDTH_RATIO * 100}%`, maxWidth: 420 }}
              data-name-card-frame="true"
            >
              <div
                className="absolute inset-[-200vmax] rounded-md"
                style={{ boxShadow: '0 0 0 200vmax rgba(0,0,0,0.55)' }}
              />
              <div className="absolute inset-0 rounded-md border-2 border-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
              <span className="absolute left-0 top-0 h-5 w-5 border-l-[3px] border-t-[3px] border-[#F5C542]" />
              <span className="absolute right-0 top-0 h-5 w-5 border-r-[3px] border-t-[3px] border-[#F5C542]" />
              <span className="absolute bottom-0 left-0 h-5 w-5 border-b-[3px] border-l-[3px] border-[#F5C542]" />
              <span className="absolute bottom-0 right-0 h-5 w-5 border-b-[3px] border-r-[3px] border-[#F5C542]" />
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-medium tracking-wide text-white/80">
                NAME CARD
              </span>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/75">가로로 맞추고 글자가 보이도록 촬영하세요</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-900/90 px-4 py-2 text-center text-sm text-white">{error}</div>
      )}

      {reviewing ? (
        <div className="flex items-center justify-center gap-3 bg-black/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={() => void retake()}
            className="min-h-12 flex-1 rounded-full border border-white/40 px-4 py-3 text-sm font-semibold text-white"
          >
            다시 찍기
          </button>
          <button
            type="button"
            onClick={confirmShot}
            className="min-h-12 flex-1 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1F1B2D]"
          >
            확인하기
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 bg-black/90 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[4.5rem] rounded-full px-3 py-2 text-sm font-medium text-white/90"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={!ready || shooting || Boolean(error)}
            onClick={() => void shoot()}
            aria-label="사진 찍기"
            className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/95 shadow-lg disabled:opacity-40"
          >
            <span className="sr-only">사진 찍기</span>
          </button>
          <span className="min-w-[4.5rem] text-center text-xs text-white/60">
            {ready ? '사진 찍기' : '연결 중'}
          </span>
        </div>
      )}
    </div>
  )
}
