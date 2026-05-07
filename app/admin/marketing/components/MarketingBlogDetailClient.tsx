'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import BlogMarkdownPreview from './BlogMarkdownPreview'

type PostDetail = {
  id: string
  title: string
  excerpt: string | null
  body: string | null
  status: string
  contentTrack: string
  monthKey: string | null
  citySlug: string | null
  linkedProductId: string | null
  generationModel: string | null
  generationPromptVersion: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  rejectedReason: string | null
  scheduledAt: string | null
  publishedAt: string | null
  url: string | null
  naverPostKey: string | null
  publishReminderSentAt: string | null
  createdAt: string
  inquiryAbsoluteUrl: string | null
  productTitle: string | null
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MarketingBlogDetailClient(props: {
  id: string
  expectedTrack: 'package' | 'airtel'
  listHref: string
}) {
  const { id, expectedTrack, listHref } = props

  const [post, setPost] = useState<PostDetail | null>(null)
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [scheduleLocal, setScheduleLocal] = useState('')
  const [publishUrl, setPublishUrl] = useState('')
  const [publishNaverKey, setPublishNaverKey] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    try {
      const res = await fetch(`/api/admin/marketing/blog-posts/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '조회 실패')
      const p = data as PostDetail
      setPost(p)
      setTitle(p.title)
      setExcerpt(p.excerpt ?? '')
      setBody(p.body ?? '')
      setScheduleLocal(toDatetimeLocalValue(p.scheduledAt))
      setPublishUrl((p.url ?? '').trim())
      setPublishNaverKey((p.naverPostKey ?? '').trim())
    } catch (e) {
      setErr(e instanceof Error ? e.message : '조회 실패')
      setPost(null)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      const res = await fetch(`/api/admin/marketing/blog-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '요청 실패')
      setMsg('저장되었습니다.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setBusy(false)
    }
  }

  const copyUtm = async () => {
    if (!post?.inquiryAbsoluteUrl) return
    try {
      await navigator.clipboard.writeText(post.inquiryAbsoluteUrl)
      setMsg('상담 URL을 복사했습니다.')
    } catch {
      setErr('복사에 실패했습니다.')
    }
  }

  const del = async () => {
    if (!window.confirm('삭제할까요? (복구 불가)')) return
    setBusy(true)
    setErr('')
    try {
      const res = await fetch(`/api/admin/marketing/blog-posts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      window.location.href = listHref
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  if (!post && !err) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center text-bt-body/70">
        불러오는 중…
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href={listHref} className="text-sm text-bt-brand-blue hover:underline">
          ← 목록
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      </div>
    )
  }

  if (post.contentTrack !== expectedTrack) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href={listHref} className="text-sm text-bt-brand-blue hover:underline">
          ← 목록
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          이 글은 이 채널과 맞지 않습니다 (contentTrack={post.contentTrack}).
        </div>
      </div>
    )
  }

  const canDelete = post.status === 'draft' || post.status === 'rejected'

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={listHref} className="text-sm text-bt-brand-blue hover:underline">
            ← 목록
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-bt-title">블로그 초안</h1>
          <p className="mt-1 text-sm text-bt-body/70">
            상태: <span className="font-medium text-bt-title">{post.status}</span> · 트랙: {post.contentTrack}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.linkedProductId && (
            <Link
              href={`/admin/products/${post.linkedProductId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-bt-border-strong bg-white px-3 py-2 text-sm hover:bg-bt-surface-soft"
            >
              상품 편집
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => void del()}
              disabled={busy}
              className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${err ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-900'}`}
        >
          {err || msg}
        </div>
      )}

      <section className="rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">상담 UTM URL</h2>
        {post.inquiryAbsoluteUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full flex-1 break-all rounded bg-bt-surface-soft px-2 py-1 text-xs">
              {post.inquiryAbsoluteUrl}
            </code>
            <button
              type="button"
              onClick={() => void copyUtm()}
              className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              복사
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-bt-body/70">linkedProduct·monthKey 가 없으면 생성할 수 없습니다.</p>
        )}
        {post.productTitle && (
          <p className="mt-2 text-xs text-bt-body/60">상품: {post.productTitle}</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">본문 수정</h2>
        <label className="block text-xs text-bt-body/80">
          제목
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-bt-body/80">
          요약
          <input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-bt-body/80">
          본문 (마크다운)
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void patch({
              action: 'edit',
              title,
              excerpt: excerpt.trim() || null,
              body,
            })
          }
          className="rounded-lg bg-bt-title px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          본문 저장
        </button>
      </section>

      <section className="rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-bt-title">미리보기</h2>
        <BlogMarkdownPreview markdown={body} />
      </section>

      <section className="flex flex-wrap gap-2 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ action: 'approve' })}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          승인
        </button>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-bt-body/80">
            거절 사유
            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-1 block w-56 rounded border border-bt-border-strong px-2 py-1.5 text-sm"
              placeholder="필수"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch({ action: 'reject', rejectedReason: rejectReason.trim() })}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            거절
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm('Gemini로 본문을 다시 생성합니다. 진행할까요?')) return
            void patch({ action: 'regenerate' })
          }}
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          재생성
        </button>
      </section>

      {post.status === 'approved' && (
        <section className="flex flex-wrap items-end gap-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
          <h2 className="w-full text-sm font-semibold text-bt-title">게시 예약</h2>
          <p className="w-full text-xs text-bt-body/70">
            승인된 글만 예약할 수 있습니다. 예약 후 cron이 예정 시각에 자동으로 published 로 올리며, 네이버 URL은 아래에서 입력합니다.
          </p>
          <label className="text-xs text-bt-body/80">
            게시 예약 시각
            <input
              type="datetime-local"
              value={scheduleLocal}
              onChange={(e) => setScheduleLocal(e.target.value)}
              className="mt-1 block rounded border border-bt-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy || !scheduleLocal}
            onClick={() => {
              const d = new Date(scheduleLocal)
              if (Number.isNaN(d.getTime())) {
                setErr('예약 시각이 올바르지 않습니다.')
                return
              }
              void patch({ action: 'schedule', scheduledAt: d.toISOString() })
            }}
            className="rounded-lg bg-bt-brand-blue px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            게시 예약 저장
          </button>
        </section>
      )}

      {(post.status === 'scheduled' || post.status === 'approved') && (
        <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-bt-title">게시 완료 (네이버)</h2>
          <p className="text-xs text-bt-body/70">
            네이버에 직접 게시한 뒤 글 URL을 입력하고 저장합니다. 예약만 두고 URL은 나중에 넣을 수도 있습니다.
          </p>
          <label className="block text-xs text-bt-body/80">
            네이버 글 URL (필수)
            <input
              value={publishUrl}
              onChange={(e) => setPublishUrl(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 text-sm"
              placeholder="https://blog.naver.com/..."
            />
          </label>
          <label className="block text-xs text-bt-body/80">
            naverPostKey (선택)
            <input
              value={publishNaverKey}
              onChange={(e) => setPublishNaverKey(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy || !publishUrl.trim()}
            onClick={() => {
              if (!window.confirm('게시 완료로 저장할까요? (published, URL 기록)')) return
              void patch({
                action: 'publish',
                url: publishUrl.trim(),
                naverPostKey: publishNaverKey.trim() || undefined,
              })
            }}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            게시 완료 저장
          </button>
        </section>
      )}

      {post.status === 'published' && (
        <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-bt-title">네이버 URL 보완</h2>
          {post.url ? (
            <p className="text-sm">
              현재 URL:{' '}
              <a href={post.url} target="_blank" rel="noreferrer" className="text-bt-brand-blue underline">
                {post.url}
              </a>
            </p>
          ) : (
            <p className="text-sm text-amber-800">자동 전환만 된 상태입니다. 네이버 글 URL을 아래에 입력하세요.</p>
          )}
          <label className="block text-xs text-bt-body/80">
            네이버 글 URL
            <input
              value={publishUrl}
              onChange={(e) => setPublishUrl(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-bt-body/80">
            naverPostKey (선택)
            <input
              value={publishNaverKey}
              onChange={(e) => setPublishNaverKey(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy || !publishUrl.trim()}
            onClick={() =>
              void patch({
                action: 'publish',
                url: publishUrl.trim(),
                naverPostKey: publishNaverKey.trim() || undefined,
              })
            }
            className="rounded-lg border border-bt-border-strong bg-bt-surface-soft px-3 py-2 text-sm hover:bg-white disabled:opacity-50"
          >
            URL 저장
          </button>
        </section>
      )}

      <section className="rounded-lg border border-bt-border-strong bg-bt-surface-soft p-4 text-xs text-bt-body/70">
        <p>생성: {new Date(post.createdAt).toLocaleString('ko-KR')}</p>
        {post.reviewedAt && (
          <p>
            검수: {new Date(post.reviewedAt).toLocaleString('ko-KR')} ({post.reviewedBy ?? '—'})
          </p>
        )}
        {post.scheduledAt && <p>예약: {new Date(post.scheduledAt).toLocaleString('ko-KR')}</p>}
        {post.publishedAt && <p>게시(publishedAt): {new Date(post.publishedAt).toLocaleString('ko-KR')}</p>}
        {post.publishReminderSentAt && (
          <p>Solapi 예약 알림 발송: {new Date(post.publishReminderSentAt).toLocaleString('ko-KR')}</p>
        )}
        {post.rejectedReason && <p className="mt-1 text-red-700">거절 사유: {post.rejectedReason}</p>}
        <p className="mt-1">모델: {post.generationModel ?? '—'}</p>
        <p>프롬프트: {post.generationPromptVersion ?? '—'}</p>
      </section>
    </div>
  )
}
