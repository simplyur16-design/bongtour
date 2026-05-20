'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import {
  TRAINING_AUDIENCE_LABELS,
  TRAINING_CATEGORY_LABELS,
  TRAINING_CATEGORY_VALUES,
  TRAINING_AUDIENCE_VALUES,
} from '@/lib/overseas-training-taxonomy'
import type { TrainingProgramAdminRow } from '@/lib/overseas-training-admin'
import { trainingProgramPublicPath } from '@/lib/overseas-training-program-query'
import { ADMIN_BTN_PRIMARY_CLASS, ADMIN_BTN_SECONDARY_CLASS } from '@/lib/admin-design-system'

const WEEKDAY_OPTIONS = [
  { v: '', label: '미정' },
  { v: '0', label: '일요일 출발' },
  { v: '1', label: '월요일 출발' },
  { v: '2', label: '화요일 출발' },
  { v: '3', label: '수요일 출발' },
  { v: '4', label: '목요일 출발' },
  { v: '5', label: '금요일 출발' },
  { v: '6', label: '토요일 출발' },
]

type Props = {
  productId: string | null
  initial: TrainingProgramAdminRow | null
}

export default function TrainingProgramAdminEditor({ productId, initial }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [windsorPaste, setWindsorPaste] = useState('')
  const [originUrl, setOriginUrl] = useState(initial?.originUrl ?? '')
  const [parsing, setParsing] = useState(false)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [originalTitle, setOriginalTitle] = useState(initial?.originalTitle ?? '')
  const [registrationStatus, setRegistrationStatus] = useState(initial?.registrationStatus ?? 'pending')
  const [trainingDescription, setTrainingDescription] = useState(initial?.trainingDescription ?? '')
  const [prepChecklistJson, setPrepChecklistJson] = useState(initial?.prepChecklistJson ?? '[]')
  const [schedule, setSchedule] = useState(initial?.schedule ?? '[]')
  const [fixedDepartureWeekday, setFixedDepartureWeekday] = useState(
    initial?.fixedDepartureWeekday != null ? String(initial.fixedDepartureWeekday) : ''
  )
  const [durationDays, setDurationDays] = useState(
    initial?.durationDays != null ? String(initial.durationDays) : ''
  )
  const [trainingCategory, setTrainingCategory] = useState(initial?.trainingCategory ?? '')
  const [trainingAudience, setTrainingAudience] = useState(initial?.trainingAudience ?? 'both')
  const [destinationSummary, setDestinationSummary] = useState(
    initial?.primaryDestination ?? initial?.destinationRaw ?? ''
  )
  const [bgImageUrl, setBgImageUrl] = useState(initial?.bgImageUrl ?? '')
  const [promptOverride, setPromptOverride] = useState('')
  const [imageBusy, setImageBusy] = useState(false)

  const publicPath =
    initial?.slug || initial?.id
      ? trainingProgramPublicPath({ id: initial?.id ?? productId ?? '', slug: initial?.slug ?? null })
      : null

  const buildPayload = useCallback(
    () => ({
      title,
      originalTitle: originalTitle || null,
      originUrl: originUrl || null,
      registrationStatus,
      trainingDescription,
      prepChecklistJson,
      schedule,
      fixedDepartureWeekday: fixedDepartureWeekday === '' ? null : Number(fixedDepartureWeekday),
      durationDays: durationDays === '' ? null : Number(durationDays),
      trainingCategory: trainingCategory || null,
      trainingAudience: trainingAudience || null,
      destinationSummary: destinationSummary || null,
      bgImageUrl: bgImageUrl || null,
      bgImageIsGenerated: Boolean(bgImageUrl),
    }),
    [
      title,
      originalTitle,
      originUrl,
      registrationStatus,
      trainingDescription,
      prepChecklistJson,
      schedule,
      fixedDepartureWeekday,
      durationDays,
      trainingCategory,
      trainingAudience,
      destinationSummary,
      bgImageUrl,
    ]
  )

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const payload = buildPayload()
      const url = productId ? `/api/admin/training-programs/${productId}` : '/api/admin/training-programs'
      const method = productId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { ok?: boolean; errors?: string[]; error?: string; product?: { id: string } }
      if (!res.ok || !data.ok) {
        setMsg(data.errors?.join(' ') || data.error || '저장 실패')
        return
      }
      setMsg('저장되었습니다.')
      if (!productId && data.product?.id) {
        router.replace(`/admin/training-programs/${data.product.id}`)
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 오류')
    } finally {
      setSaving(false)
    }
  }

  const parseWindsor = async () => {
    setParsing(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/training-programs/parse-windsor-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedText: windsorPaste, originUrl }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        draft?: {
          originalTitle?: string | null
          trainingDescription?: string | null
          scheduleJson?: string | null
          prepChecklistJson?: string | null
          fixedDepartureWeekday?: number | null
          durationDays?: number | null
          trainingCategory?: string | null
          trainingAudience?: string | null
          destinationSummary?: string | null
          parseWarning?: string | null
        }
        error?: string
      }
      if (!res.ok || !data.ok || !data.draft) {
        setMsg(data.error ?? '분할 실패')
        return
      }
      const d = data.draft
      if (d.originalTitle) setOriginalTitle(d.originalTitle)
      if (d.trainingDescription) setTrainingDescription(d.trainingDescription)
      if (d.scheduleJson) setSchedule(d.scheduleJson)
      if (d.prepChecklistJson) setPrepChecklistJson(d.prepChecklistJson)
      if (d.fixedDepartureWeekday != null) setFixedDepartureWeekday(String(d.fixedDepartureWeekday))
      if (d.durationDays != null) setDurationDays(String(d.durationDays))
      if (d.trainingCategory) setTrainingCategory(d.trainingCategory)
      if (d.trainingAudience) setTrainingAudience(d.trainingAudience)
      if (d.destinationSummary) setDestinationSummary(d.destinationSummary)
      setMsg(d.parseWarning ? `분할 완료 (주의: ${d.parseWarning})` : '윈저 본문 분할 완료 — 검수 후 저장하세요.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '분할 오류')
    } finally {
      setParsing(false)
    }
  }

  const suggestTitle = async () => {
    const res = await fetch('/api/admin/training-programs/suggest-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalTitle: originalTitle || title,
        trainingCategory,
        destinationSummary,
        durationDays: durationDays === '' ? null : Number(durationDays),
      }),
    }).catch(() => null)
    if (!res) return
    const data = (await res.json()) as { ok?: boolean; title?: string; error?: string }
    if (data.ok && data.title) {
      setTitle(data.title)
      setMsg('봉투어 스타일 제목을 적용했습니다.')
    } else {
      setMsg(data.error ?? '제목 제안 실패')
    }
  }

  const generateImage = async () => {
    setImageBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/gemini/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: 'overseas_training',
          title,
          destination: destinationSummary,
          trainingCategory,
          trainingDescription: trainingDescription.slice(0, 2000),
          promptOverride: promptOverride || undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        images?: { slot: string; imageUrl: string | null }[]
        error?: string
      }
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? '이미지 생성 실패')
        return
      }
      const first = data.images?.find((x) => x.imageUrl)?.imageUrl
      if (first) {
        setBgImageUrl(first)
        setMsg('대표 이미지를 적용했습니다. 저장을 눌러 반영하세요.')
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '이미지 오류')
    } finally {
      setImageBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {productId ? '국외연수 프로그램 편집' : '국외연수 프로그램 등록'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            <Link href="/admin/training-programs/guide" className="text-bt-link hover:underline">
              운영 가이드
            </Link>
            {' · '}
            <Link href="/admin/training-programs" className="text-bt-link hover:underline">
              목록
            </Link>
          </p>
        </div>
        {publicPath && registrationStatus === 'registered' ? (
          <a href={publicPath} target="_blank" rel="noopener noreferrer" className={ADMIN_BTN_SECONDARY_CLASS}>
            공개 페이지
          </a>
        ) : null}
      </div>

      {msg ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800">{msg}</p>
      ) : null}

      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
        <h2 className="font-semibold text-slate-900">1. 윈저·협력사 본문 붙여넣기</h2>
        <input
          type="url"
          value={originUrl}
          onChange={(e) => setOriginUrl(e.target.value)}
          placeholder="원문 URL (선택)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={windsorPaste}
          onChange={(e) => setWindsorPaste(e.target.value)}
          rows={8}
          placeholder="상품 페이지 HTML/텍스트를 붙여넣으세요"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
        />
        <button
          type="button"
          disabled={parsing}
          onClick={() => void parseWindsor()}
          className={ADMIN_BTN_SECONDARY_CLASS}
        >
          {parsing ? '분할 중…' : '3블록으로 분할 (Gemini)'}
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">2. 기본 정보</h2>
        <label className="block text-sm font-medium text-slate-700">
          원문 제목 (윈저)
          <input
            value={originalTitle}
            onChange={(e) => setOriginalTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="flex-1 text-sm font-medium text-slate-700">
            봉투어 노출 제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button type="button" onClick={() => void suggestTitle()} className={`${ADMIN_BTN_SECONDARY_CLASS} self-end`}>
            제목 제안
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            분야
            <select
              value={trainingCategory}
              onChange={(e) => setTrainingCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">선택</option>
              {TRAINING_CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {TRAINING_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            대상
            <select
              value={trainingAudience}
              onChange={(e) => setTrainingAudience(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {TRAINING_AUDIENCE_VALUES.map((a) => (
                <option key={a} value={a}>
                  {TRAINING_AUDIENCE_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            출발 요일
            <select
              value={fixedDepartureWeekday}
              onChange={(e) => setFixedDepartureWeekday(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {WEEKDAY_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            일수
            <input
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">
            목적지 요약
            <input
              value={destinationSummary}
              onChange={(e) => setDestinationSummary(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            게시 상태
            <select
              value={registrationStatus}
              onChange={(e) => setRegistrationStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="pending">대기 (비공개)</option>
              <option value="registered">게시 (공개)</option>
              <option value="on_hold">보류</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">3. 상품설명</h2>
        <textarea
          value={trainingDescription}
          onChange={(e) => setTrainingDescription(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">4. 상세일정 (JSON)</h2>
        <p className="text-xs text-slate-500">[{`{ "day": 1, "description": "..." }`}, …]</p>
        <textarea
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">5. 여행준비·체크 (JSON)</h2>
        <p className="text-xs text-slate-500">[{`{ "title": "출발 전", "items": ["…"] }`}, …]</p>
        <textarea
          value={prepChecklistJson}
          onChange={(e) => setPrepChecklistJson(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">6. 대표 이미지 (Gemini)</h2>
        <textarea
          value={promptOverride}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={3}
          placeholder="프롬프트 직접 입력 (선택, 영문 권장)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" disabled={imageBusy} onClick={() => void generateImage()} className={ADMIN_BTN_SECONDARY_CLASS}>
          {imageBusy ? '생성 중…' : 'AI 이미지 생성 (2장 중 1번 적용)'}
        </button>
        {bgImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgImageUrl} alt="" className="max-h-48 rounded-lg border object-cover" />
        ) : null}
        <input
          value={bgImageUrl}
          onChange={(e) => setBgImageUrl(e.target.value)}
          placeholder="이미지 URL (수동 붙여넣기 가능)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => void save()} className={ADMIN_BTN_PRIMARY_CLASS}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
