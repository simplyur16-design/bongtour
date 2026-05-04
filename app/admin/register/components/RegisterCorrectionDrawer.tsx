'use client'

import type { RegisterPreviewPayload as RegisterPreviewPayloadH } from '@/lib/register-preview-payload-hanatour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadM } from '@/lib/register-preview-payload-modetour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadV } from '@/lib/register-preview-payload-verygoodtour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadY } from '@/lib/register-preview-payload-ybtour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadK } from '@/lib/register-preview-payload-kyowontour'
import type {
  RegisterCorrectionFieldKey,
  RegisterCorrectionOverlayV1,
  RegisterCorrectionShoppingFieldV1,
  RegisterCorrectionIssueHintDetailV1,
} from '@/lib/register-correction-types-hanatour'
import { REGISTER_CORRECTION_PREVIEW_VERSION } from '@/lib/register-correction-types-hanatour'

type RegisterPreviewPayload =
  | RegisterPreviewPayloadH
  | RegisterPreviewPayloadM
  | RegisterPreviewPayloadV
  | RegisterPreviewPayloadY
  | RegisterPreviewPayloadK
import RegisterShoppingCorrectionEditor from './RegisterShoppingCorrectionEditor'

type Props = {
  open: boolean
  onClose: () => void
  /** 열 때 포커스할 교정 키(이슈에서 전달) */
  targetKey: RegisterCorrectionFieldKey | null
  preview: RegisterPreviewPayload
  overlay: RegisterCorrectionOverlayV1 | null
  onCommitShopping: (next: RegisterCorrectionShoppingFieldV1) => void
  /** issue 상세(근거) — correctionPreview.issueHintDetails 에서 매칭 */
  hintDetail: RegisterCorrectionIssueHintDetailV1 | null
}

export default function RegisterCorrectionDrawer({
  open,
  onClose,
  targetKey,
  preview,
  overlay,
  onCommitShopping,
  hintDetail,
}: Props) {
  if (!open) return null

  const cp = preview.correctionPreview
  const title =
    targetKey === 'shopping'
      ? '쇼핑 교정'
      : targetKey
        ? `필드 교정 · ${targetKey}`
        : '교정'

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/40"
        aria-label="교정 패널 닫기"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-correction-drawer-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 id="register-correction-drawer-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              자동 추출값과 최종 교정값을 분리합니다. 재분석 시 수동·승인 교정은 유지됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {hintDetail ? (
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{hintDetail.field}</p>
              <p className="mt-1">{hintDetail.reason}</p>
              {(hintDetail.evidence.rawSnippet || hintDetail.evidence.sourceSummary) && (
                <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                  {hintDetail.evidence.sourceKind ? (
                    <p className="text-slate-500">근거 유형: {hintDetail.evidence.sourceKind}</p>
                  ) : null}
                  {hintDetail.evidence.sourceSummary ? (
                    <p className="mt-1 whitespace-pre-wrap">{hintDetail.evidence.sourceSummary}</p>
                  ) : null}
                  {hintDetail.evidence.rawSnippet ? (
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[10px] text-slate-600">
                      {hintDetail.evidence.rawSnippet}
                    </pre>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {(() => {
            const traces = preview.registerVerification?.fieldIssueTraces
            const match = traces?.find((t) => t.field === hintDetail?.field)
            if (!match) return null
            return (
              <div className="mb-4 rounded border border-violet-200 bg-violet-50 p-3 text-xs text-violet-950">
                <p className="font-semibold text-violet-900">실검증 추적 힌트 (동일 필드)</p>
                <p className="mt-1 text-[11px] leading-relaxed">{match.traceHint}</p>
              </div>
            )
          })()}

          {targetKey === 'shopping' && cp?.version === REGISTER_CORRECTION_PREVIEW_VERSION ? (
            <RegisterShoppingCorrectionEditor
              key={`${preview.previewToken ?? 'pt'}-shopping`}
              shoppingPreview={cp.shopping}
              initial={overlay?.fields.shopping ?? null}
              onCancel={onClose}
              onSave={(next) => {
                onCommitShopping(next)
                onClose()
              }}
            />
          ) : (
            <div className="text-sm text-slate-600">
              <p>
                이 필드는 아직 전용 교정 화면이 없습니다. 쇼핑 관련 이슈는 <strong>쇼핑</strong> 키워드가 포함된 항목에서
                쇼핑 편집기를 사용하세요.
              </p>
              {!cp ? (
                <p className="mt-2 text-amber-800">
                  미리보기 응답에 correctionPreview가 없습니다. 서버를 최신으로 한 뒤 다시 분석하세요.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
