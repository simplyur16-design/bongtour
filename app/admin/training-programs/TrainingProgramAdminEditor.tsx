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
import {
  EUROPE_PREP_DEFAULT_MARKER,
  prepChecklistForSave,
  usesEuropePrepDefault,
} from '@/lib/overseas-training-europe-prep-default'
import {
  parseTrainingScheduleFromProduct,
  serializeTrainingScheduleRaw,
  trainingScheduleToAdminText,
} from '@/lib/overseas-training-schedule-ssot'
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
  const [useEuropePrepDefault, setUseEuropePrepDefault] = useState(
    initial ? usesEuropePrepDefault(initial.prepChecklistJson) : true
  )
  const [prepChecklistJson, setPrepChecklistJson] = useState(
    initial?.prepChecklistJson && !usesEuropePrepDefault(initial.prepChecklistJson)
      ? initial.prepChecklistJson
      : '[]'
  )
  const [scheduleText, setScheduleText] = useState(() =>
    trainingScheduleToAdminText(parseTrainingScheduleFromProduct(initial?.schedule))
  )
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
  const [bgImageIsGenerated, setBgImageIsGenerated] = useState(initial?.bgImageIsGenerated ?? false)
  const [promptOverride, setPromptOverride] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [promptPreview, setPromptPreview] = useState<{ slot: string; text: string }[] | null>(null)
  const [promptPreviewBusy, setPromptPreviewBusy] = useState(false)

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
      prepChecklistJson: prepChecklistForSave(useEuropePrepDefault, prepChecklistJson),
      schedule: serializeTrainingScheduleRaw(scheduleText),
      fixedDepartureWeekday: fixedDepartureWeekday === '' ? null : Number(fixedDepartureWeekday),
      durationDays: durationDays === '' ? null : Number(durationDays),
      trainingCategory: trainingCategory || null,
      trainingAudience: trainingAudience || null,
      destinationSummary: destinationSummary || null,
      bgImageUrl: bgImageUrl || null,
      bgImageIsGenerated,
    }),
    [
      title,
      originalTitle,
      originUrl,
      registrationStatus,
      trainingDescription,
      useEuropePrepDefault,
      prepChecklistJson,
      scheduleText,
      fixedDepartureWeekday,
      durationDays,
      trainingCategory,
      trainingAudience,
      destinationSummary,
      bgImageUrl,
      bgImageIsGenerated,
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
      if (d.scheduleJson) {
        setScheduleText(
          trainingScheduleToAdminText(parseTrainingScheduleFromProduct(d.scheduleJson))
        )
      }
      if (d.prepChecklistJson) {
        setUseEuropePrepDefault(false)
        setPrepChecklistJson(d.prepChecklistJson)
      }
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

  const previewImagePrompts = async () => {
    setPromptPreviewBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/training-programs/preview-image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          destination: destinationSummary,
          trainingCategory,
          trainingDescription: trainingDescription.slice(0, 2000),
          promptOverride: promptOverride || undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        promptsBySlot?: { slot: string; text: string }[]
        error?: string
      }
      if (!res.ok || !data.ok || !data.promptsBySlot) {
        setMsg(data.error ?? '프롬프트 미리보기 실패')
        return
      }
      setPromptPreview(data.promptsBySlot)
      setMsg('슬롯별 프롬프트를 표시했습니다. 외부 Gemini·Imagen에 복사해 쓸 수 있습니다.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '프롬프트 미리보기 오류')
    } finally {
      setPromptPreviewBusy(false)
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
        promptsBySlot?: { slot: string; text: string }[]
        error?: string
      }
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? '이미지 생성 실패')
        return
      }
      if (data.promptsBySlot?.length) setPromptPreview(data.promptsBySlot)
      const first = data.images?.find((x) => x.imageUrl)?.imageUrl
      if (first) {
        setBgImageUrl(first)
        setBgImageIsGenerated(true)
        setMsg('대표 이미지를 적용했습니다. 저장을 눌러 반영하세요.')
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '이미지 오류')
    } finally {
      setImageBusy(false)
    }
  }

  const uploadImage = async (file: File) => {
    setUploadBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('cardKey', 'training')
      const res = await fetch('/api/admin/upload-image', { method: 'POST', body: fd })
      const data = (await res.json()) as { ok?: boolean; path?: string; error?: string }
      if (!res.ok || !data.ok || !data.path) {
        setMsg(data.error ?? '업로드 실패')
        return
      }
      setBgImageUrl(data.path)
      setBgImageIsGenerated(false)
      setMsg('업로드한 이미지를 적용했습니다. 저장을 눌러 반영하세요.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '업로드 오류')
    } finally {
      setUploadBusy(false)
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

      <p className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm leading-relaxed text-emerald-950">
        윈저·협력사 페이지에서 <strong>상품설명</strong>과 <strong>상세일정</strong>을 각각 복사해 아래{' '}
        <strong>2·3번 칸</strong>에 따로 붙여넣으세요. 한 번에 통째로 넣는 칸은 없습니다. 여행준비·약관은 4번(유럽
        공통 기본) 또는 선택 통합 분할을 쓰세요.
      </p>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">1. 기본 정보</h2>
        <label className="block text-sm font-medium text-slate-700">
          원문 URL (윈저·협력사, 선택)
          <input
            type="url"
            value={originUrl}
            onChange={(e) => setOriginUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
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

      <section className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
        <h2 className="font-semibold text-slate-900">2. 상품설명 (윈저 「상품설명」만)</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          협력사 상세 페이지 <strong>「상품설명」</strong> 탭·블록 내용만 복사해 아래에 붙여넣으세요. 공개 페이지
          「상품설명」 탭에 <strong>그대로</strong> 나갑니다 (약 1,000자 권장, 최대 12,000자). 일차별 일정·해외여행
          안전정보·예약 유의사항은 <strong>넣지 마세요</strong> — 3번·4번에 해당합니다.
        </p>
        <textarea
          value={trainingDescription}
          onChange={(e) => setTrainingDescription(e.target.value)}
          rows={14}
          maxLength={12000}
          placeholder="윈저 상품설명 탭에서 복사한 연수 소개·기관·특징 등"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed"
        />
        <p className="text-xs text-slate-500">{trainingDescription.length} / 12000자</p>
      </section>

      <section className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
        <h2 className="font-semibold text-slate-900">3. 상세일정 (윈저 「상세일정」만)</h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          협력사 <strong>「상세일정」</strong> 탭·표 내용만 복사해 붙여넣으세요. <strong>축약·JSON 변환 없이</strong>{' '}
          공개 「상세일정」 탭 표로 표시됩니다.{' '}
          <code className="text-[11px]">1일차</code>, <code className="text-[11px]">2일차</code> 줄마다 표 행이
          나뉩니다.
        </p>
        <textarea
          value={scheduleText}
          onChange={(e) => setScheduleText(e.target.value)}
          rows={16}
          placeholder={'윈저 상세일정 탭에서 복사\n\n1일차\n…\n\n2일차\n…'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed"
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">4. 여행준비/체크사항</h2>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={useEuropePrepDefault}
            onChange={(e) => {
              setUseEuropePrepDefault(e.target.checked)
              if (e.target.checked) setPrepChecklistJson('[]')
            }}
            className="mt-1"
          />
          <span>
            유럽 연수 공통 안내문 사용 (기본) — 공개 「여행준비/체크사항」 탭에 동일 내용이 표시됩니다.
          </span>
        </label>
        {!useEuropePrepDefault ? (
          <>
            <p className="text-xs text-slate-500">
              [{`{ "title": "예약시 유의사항", "items": ["♠ …"] }`}, …] JSON
            </p>
            <textarea
              value={prepChecklistJson}
              onChange={(e) => setPrepChecklistJson(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            저장 시 공통 안내문 마커({EUROPE_PREP_DEFAULT_MARKER.slice(0, 40)}…)가 기록됩니다.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">5. 대표 이미지</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          「프롬프트 미리보기」로 슬롯별 영문 프롬프트를 확인한 뒤, 사이트 내 생성·외부 Gemini·직접 업로드 중
          선택하세요.
        </p>
        <textarea
          value={promptOverride}
          onChange={(e) => setPromptOverride(e.target.value)}
          rows={3}
          placeholder="프롬프트 직접 입력 (선택, 영문 권장)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={promptPreviewBusy}
            onClick={() => void previewImagePrompts()}
            className={ADMIN_BTN_SECONDARY_CLASS}
          >
            {promptPreviewBusy ? '불러오는 중…' : '프롬프트 미리보기'}
          </button>
          <button
            type="button"
            disabled={imageBusy}
            onClick={() => void generateImage()}
            className={ADMIN_BTN_SECONDARY_CLASS}
          >
            {imageBusy ? '생성 중…' : '사이트에서 AI 생성'}
          </button>
          <label className={`${ADMIN_BTN_SECONDARY_CLASS} cursor-pointer ${uploadBusy ? 'opacity-60' : ''}`}>
            {uploadBusy ? '업로드 중…' : '파일 업로드'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploadBusy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadImage(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {promptPreview?.length ? (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            {promptPreview.map((p) => (
              <div key={p.slot}>
                <p className="font-semibold text-slate-800">{p.slot}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{p.text}</p>
              </div>
            ))}
          </div>
        ) : null}
        {bgImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bgImageUrl} alt="" className="max-h-48 rounded-lg border object-cover" />
        ) : null}
        <input
          value={bgImageUrl}
          onChange={(e) => {
            setBgImageUrl(e.target.value)
            if (e.target.value.trim()) setBgImageIsGenerated(false)
          }}
          placeholder="이미지 URL (외부 생성·CDN 주소 붙여넣기)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <details className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          선택: 통합 본문 자동 분할 (Gemini) — 상품설명·상세일정을 따로 넣는 대신 쓸 때만
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            페이지 전체를 한 번에 붙여넣으면 Gemini가 상품설명·일정·여행준비로 나눕니다. 평소에는 2·3번에 각각
            붙여넣는 방식을 권장합니다.
          </p>
          <textarea
            value={windsorPaste}
            onChange={(e) => setWindsorPaste(e.target.value)}
            rows={8}
            placeholder="통합 HTML/텍스트 (선택)"
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
        </div>
      </details>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => void save()} className={ADMIN_BTN_PRIMARY_CLASS}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
