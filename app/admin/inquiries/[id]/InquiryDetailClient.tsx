'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import InquiryStatusSelect from '@/components/admin/InquiryStatusSelect'
import { inquiryTypeDisplayLabel, leadTimeRiskLabel, preferredContactChannelLabel } from '@/lib/admin-inquiry'
import { getSiteOrigin } from '@/lib/site-metadata'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

export type InquiryDetailDto = {
  id: string
  inquiryNumber: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  referrer: string | null
  landingPath: string | null
  inquiryType: string
  status: string
  leadTimeRisk: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  productId: string | null
  monthlyCurationItemId: string | null
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  snapshotOriginUrl: string | null
  snapshotOriginSource: string | null
  snapshotOriginCode: string | null
  sourcePagePath: string | null
  privacyAgreed: boolean
  privacyNoticeConfirmedAt: string | null
  privacyNoticeVersion: string | null
  preferredContactChannel: string | null
  selectedServiceType: string | null
  payloadJson: string | null
  routingReasonJson: string | null
  emailSentAt: string | null
  emailSentStatus: string | null
  emailError: string | null
  createdAt: string
  updatedAt: string
}

function payloadPretty(json: string | null): string {
  if (!json?.trim()) return '(없음)'
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

function quoteKindFromPayload(json: string | null): string | null {
  if (!json?.trim()) return null
  try {
    const o = JSON.parse(json) as Record<string, unknown>
    return typeof o.quoteKind === 'string' ? o.quoteKind : null
  } catch {
    return null
  }
}

export default function InquiryDetailClient({ inquiryId }: { inquiryId: string }) {
  const [row, setRow] = useState<InquiryDetailDto | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [patchError, setPatchError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoadError(null)
    const res = await fetch(`/api/admin/inquiries/${inquiryId}`)
    const data = (await res.json().catch(() => ({}))) as { inquiry?: InquiryDetailDto; error?: string }
    if (!res.ok) {
      setLoadError(data.error ?? '불러오지 못했습니다.')
      setRow(null)
      return
    }
    setRow(data.inquiry ?? null)
  }, [inquiryId])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  const origin = getSiteOrigin()
  const productUrl = row?.productId ? `${origin}/products/${row.productId}` : null

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-rose-700">{loadError}</p>
        <Link href="/admin/inquiries" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          ← 목록
        </Link>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 text-sm text-gray-500">
        로딩 중…
      </div>
    )
  }

  const qk = quoteKindFromPayload(row.payloadJson)
  const originSourceDisplay =
    formatOriginSourceForDisplay(row.snapshotOriginSource ?? '') || row.snapshotOriginSource?.trim() || '—'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/admin/inquiries" className="text-sm text-gray-500 hover:text-gray-900">
          ← 문의 목록
        </Link>

        <h1 className="mt-4 text-xl font-semibold text-gray-900">문의 상세</h1>
        <p className="mt-1 font-mono text-sm font-semibold text-gray-800">{row.inquiryNumber}</p>
        <p className="mt-0.5 font-mono text-xs text-gray-500">내부 id · {row.id}</p>

        {patchError ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{patchError}</p>
        ) : null}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">처리 상태</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <InquiryStatusSelect
              inquiryId={row.id}
              value={row.status}
              onStatusUpdated={(_id, st) => setRow((prev) => (prev ? { ...prev, status: st } : prev))}
              onError={setPatchError}
            />
            <span className="text-xs text-gray-500">목록 화면과 동일한 상태 값을 사용합니다.</span>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">신청자 정보</h2>
          <dl className="mt-3 grid gap-2 text-sm text-gray-700">
            <div>
              <dt className="text-xs font-medium text-gray-500">이름</dt>
              <dd>{row.applicantName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">연락처</dt>
              <dd className="font-mono">{row.applicantPhone}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">이메일</dt>
              <dd>{row.applicantEmail ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">개인정보 동의</dt>
              <dd>{row.privacyAgreed ? '동의' : '미동의'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">희망 답변 채널</dt>
              <dd>
                {row.preferredContactChannel === 'email' ||
                row.preferredContactChannel === 'kakao' ||
                row.preferredContactChannel === 'both'
                  ? preferredContactChannelLabel(row.preferredContactChannel)
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">상품 정보 (접수 시점 스냅샷)</h2>
          <p className="mt-1 text-xs text-amber-900/90">
            공개 상품이 자동 비공개되어도 아래 스냅샷으로 접수 당시 정보를 확인할 수 있습니다.
          </p>
          <dl className="mt-3 grid gap-3 text-sm text-gray-700">
            <div>
              <dt className="text-xs font-medium text-gray-500">상품 제목</dt>
              <dd>{row.snapshotProductTitle?.trim() || '—'}</dd>
            </div>
            {productUrl ? (
              <div>
                <dt className="text-xs font-medium text-gray-500">봉투어 상품</dt>
                <dd>
                  <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-indigo-600 hover:underline"
                  >
                    {productUrl}
                  </a>
                </dd>
              </div>
            ) : null}
            {row.snapshotOriginUrl?.trim() ? (
              <div>
                <dt className="text-xs font-medium text-gray-500">공급사 원문</dt>
                <dd>
                  <a
                    href={row.snapshotOriginUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-indigo-600 hover:underline"
                  >
                    {row.snapshotOriginUrl.trim()}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium text-gray-500">공급사 · 코드</dt>
              <dd>
                {originSourceDisplay}
                {row.snapshotOriginCode?.trim() ? ` · ${row.snapshotOriginCode.trim()}` : ''}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">상담 내용</h2>
          <dl className="mt-3 grid gap-2 text-sm text-gray-700">
            <div>
              <dt className="text-xs font-medium text-gray-500">유형</dt>
              <dd>{inquiryTypeDisplayLabel(row.inquiryType, qk)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">리드타임</dt>
              <dd>{leadTimeRiskLabel(row.leadTimeRisk)}</dd>
            </div>
            {row.selectedServiceType?.trim() ? (
              <div>
                <dt className="text-xs font-medium text-gray-500">선택 서비스 유형</dt>
                <dd>{row.selectedServiceType.trim()}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-medium text-gray-500">문의 메시지</dt>
              <dd className="whitespace-pre-wrap">{row.message?.trim() || '(없음)'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">payloadJson</dt>
              <dd>
                <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-gray-50 p-3 text-xs">
                  {payloadPretty(row.payloadJson)}
                </pre>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">유입 경로</dt>
              <dd className="break-all text-xs">{row.sourcePagePath ?? '—'}</dd>
            </div>
            {(row.referrer?.trim() ||
              row.landingPath?.trim() ||
              row.utmSource?.trim() ||
              row.utmMedium?.trim() ||
              row.utmCampaign?.trim() ||
              row.utmContent?.trim() ||
              row.utmTerm?.trim()) && (
              <div>
                <dt className="text-xs font-medium text-gray-500">유입·UTM (첫 세션)</dt>
                <dd className="mt-1 space-y-1 break-all text-xs text-gray-700">
                  {row.referrer?.trim() ? <div>referrer: {row.referrer.trim()}</div> : null}
                  {row.landingPath?.trim() ? <div>landingPath: {row.landingPath.trim()}</div> : null}
                  {row.utmSource?.trim() ? <div>utm_source → utmSource: {row.utmSource.trim()}</div> : null}
                  {row.utmMedium?.trim() ? <div>utm_medium → utmMedium: {row.utmMedium.trim()}</div> : null}
                  {row.utmCampaign?.trim() ? <div>utm_campaign → utmCampaign: {row.utmCampaign.trim()}</div> : null}
                  {row.utmContent?.trim() ? <div>utm_content → utmContent: {row.utmContent.trim()}</div> : null}
                  {row.utmTerm?.trim() ? <div>utm_term → utmTerm: {row.utmTerm.trim()}</div> : null}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">메타</h2>
          <dl className="mt-3 grid gap-2 text-xs text-gray-600">
            <div>접수: {new Date(row.createdAt).toLocaleString('ko-KR')}</div>
            <div>수정: {new Date(row.updatedAt).toLocaleString('ko-KR')}</div>
            <div>
              이메일 알림: {row.emailSentStatus ?? '—'}{' '}
              {row.emailSentAt ? `(${new Date(row.emailSentAt).toLocaleString('ko-KR')})` : ''}
            </div>
            {row.emailError ? <div className="text-rose-700">emailError: {row.emailError}</div> : null}
          </dl>
        </section>
      </div>
    </div>
  )
}
