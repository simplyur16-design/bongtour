'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import NameCardCameraOverlay from '@/components/mypage/NameCardCameraOverlay'

type Latest = {
  id: string
  status: string
  imageUrl: string
  ocrName: string | null
  ocrCompany: string | null
  ocrEmail: string | null
  ocrPhone: string | null
  ocrPosition: string | null
  createdAt: string
  reviewedAt: string | null
  adminNote: string | null
} | null

type Initial = {
  pressVerified: boolean
  affiliationVerified: boolean
  affiliationVerifiedAt: string | null
  affiliationOrgName: string | null
  affiliationCardImageUrl: string | null
  latest: Latest
}

function useIsMobileCapture(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])
  return mobile
}

export default function AffiliationCardClient({ initial }: { initial: Initial }) {
  const isMobile = useIsMobileCapture()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [latest, setLatest] = useState<Latest>(initial.latest)
  const [cameraOpen, setCameraOpen] = useState(false)
  const verified = initial.affiliationVerified || initial.pressVerified

  const statusLabel = useMemo(() => {
    if (verified) return '할인 적용 중'
    if (latest?.status === 'pending') return '관리자 검토 중'
    if (latest?.status === 'rejected') return '반려됨 — 다시 제출 가능'
    return '미제출'
  }, [verified, latest])

  function onPick(f: File | null) {
    setError(null)
    setOkMsg(null)
    if (!f) {
      setFile(null)
      setPreview(null)
      return
    }
    if (!f.type.startsWith('image/')) {
      setError('이미지 파일만 선택할 수 있습니다.')
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    if (!file) {
      setError('명함 사진을 선택해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    setOkMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/bongsim/mypage/affiliation-card', {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        error?: string
        ok?: boolean
        imageUrl?: string
        fields?: { company?: string | null; name?: string | null }
      }
      if (!res.ok || !data.ok) {
        setError(data.message || data.error || '제출에 실패했습니다.')
        return
      }
      setOkMsg('명함이 접수되었습니다. 관리자 확인 후 할인이 적용됩니다.')
      setLatest({
        id: 'new',
        status: 'pending',
        imageUrl: data.imageUrl || preview || '',
        ocrName: data.fields?.name ?? null,
        ocrCompany: data.fields?.company ?? null,
        ocrEmail: null,
        ocrPhone: null,
        ocrPosition: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        adminNote: null,
      })
      setFile(null)
    } finally {
      setBusy(false)
    }
  }

  if (verified) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
        <h1 className="text-xl font-semibold text-[#1F1B2D]">소속 명함 인증</h1>
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          eSIM 직군 할인이 적용 중입니다.
          {initial.affiliationOrgName ? ` (${initial.affiliationOrgName})` : null}
          {initial.pressVerified ? ' · 언론사 이메일 인증' : null}
        </p>
        {(initial.affiliationCardImageUrl || latest?.imageUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initial.affiliationCardImageUrl || latest?.imageUrl || ''}
            alt="승인된 명함"
            className="max-h-64 w-full rounded-lg object-contain bg-slate-50"
          />
        )}
        <Link href="/mypage" className="text-sm text-[#5B4B8A] underline">
          마이페이지로
        </Link>
      </div>
    )
  }

  const pending = latest?.status === 'pending'

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1F1B2D]">소속 명함 인증</h1>
        <p className="mt-1 text-sm text-slate-600">
          명함을 제출하면 관리자 확인 후 eSIM 할인이 지속 적용됩니다. 상태: {statusLabel}
        </p>
      </div>

      {pending && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          검토 중인 명함이 있습니다. 승인될 때까지 기다려 주세요.
          {latest?.ocrCompany ? ` (인식: ${latest.ocrCompany})` : null}
        </div>
      )}

      {latest?.status === 'rejected' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          이전 제출이 반려되었습니다.
          {latest.adminNote ? ` 사유: ${latest.adminNote}` : ' 명함을 다시 촬영·업로드해 주세요.'}
        </div>
      )}

      {!pending && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            {isMobile && (
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex-1 rounded-lg bg-[#1F1B2D] px-4 py-3 text-sm font-medium text-white"
              >
                사진 촬영
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-[#1F1B2D]"
            >
              사진 업로드
            </button>
          </div>

          {isMobile && (
            <p className="text-xs text-slate-500">
              촬영 → 확인하기 / 다시 찍기. 명함 틀 안에 맞춰 찍으면 인식이 더 잘 됩니다.
            </p>
          )}

          {preview && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="명함 미리보기"
                className="max-h-72 w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
              />
              <p className="text-center text-xs text-slate-500">미리보기 — 확인 후 제출하세요</p>
            </div>
          )}

          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void submit()}
            className="w-full rounded-lg bg-[#5B4B8A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '제출 중…' : '명함 제출'}
          </button>
        </>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {okMsg && <p className="text-sm text-emerald-700">{okMsg}</p>}

      <p className="text-xs text-slate-500">
        언론사 직장 이메일이 있으면{' '}
        <Link href="/mypage/press" className="underline">
          직군 이메일 인증
        </Link>
        으로도 할인을 받을 수 있습니다.
      </p>

      {isMobile && (
        <NameCardCameraOverlay
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCaptured={(f) => onPick(f)}
        />
      )}
    </div>
  )
}
