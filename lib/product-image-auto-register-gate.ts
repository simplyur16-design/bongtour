/**
 * WORK-ORDER 8 3단계(준비): 자동 이미지 채움에 출처 정책 연결 — 신규(pre_photo_blocked)·등록대기(pending)만.
 * - 기본 꺼짐: BONGTOUR_IMAGE_POLICY_AUTO_REGISTER=1 일 때만 동작(배포돼도 켜기 전에는 기존 동작 그대로).
 * - 기존 iStock(허용 목록) 대표 사진은 덮어쓰지 않음.
 * - 정책 불합격 후보는 대표 사진으로 쓰지 않고(기존 값 유지) needsImageReview=true 로 남김.
 * - Pexels·Unsplash·CC0 출처 기록(작가·원본링크·ID)은 새로 만들지 않음(의무 아님, 사장님 10/30).
 * - 쓰는 칸: 대표 사진(bg*) 이미지 칸만.
 * REGRESSION-FREEZE[product-image-auto-register-gate]: 신규·등록대기만, 기본 꺼짐, 기존 iStock 유지, 불합격=보류 — manifest
 */
import {
  evaluateImageCandidatePolicy,
  isExistingIstockImage,
  resolveImageSourceTier,
  type ImageCandidate,
  type ImagePolicyResult,
} from '@/lib/product-image-source-policy'

export const IMAGE_POLICY_AUTO_REGISTER_ENV = 'BONGTOUR_IMAGE_POLICY_AUTO_REGISTER'

/** 정책을 적용할 등록 상태: 신규(사진 전 차단) · 등록대기 */
export const IMAGE_POLICY_AUTO_REGISTER_STATUSES: readonly string[] = ['pre_photo_blocked', 'pending'] as const

export function isImagePolicyAutoRegisterEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env[IMAGE_POLICY_AUTO_REGISTER_ENV] ?? '').trim() === '1'
}

export function isImagePolicyAutoRegisterStatus(status: string | null | undefined): boolean {
  const s = String(status ?? 'pending').trim() || 'pending'
  return IMAGE_POLICY_AUTO_REGISTER_STATUSES.includes(s)
}

export type AutoCoverDecision =
  | { action: 'legacy'; reason: 'flag_off' | 'status_out_of_scope' }
  | { action: 'keep_existing_istock'; reason: 'existing_istock' }
  | { action: 'write'; policy: ImagePolicyResult; isGenerated: boolean }
  | { action: 'hold'; policy: ImagePolicyResult }

export function decideAutoCoverWrite(params: {
  enabled: boolean
  registrationStatus: string | null | undefined
  currentCoverUrl: string | null | undefined
  currentCoverSource: string | null | undefined
  candidate: ImageCandidate
}): AutoCoverDecision {
  if (!params.enabled) return { action: 'legacy', reason: 'flag_off' }
  if (!isImagePolicyAutoRegisterStatus(params.registrationStatus)) return { action: 'legacy', reason: 'status_out_of_scope' }
  const cur = String(params.currentCoverUrl ?? '').trim()
  if (cur && isExistingIstockImage(cur)) return { action: 'keep_existing_istock', reason: 'existing_istock' }
  const policy = evaluateImageCandidatePolicy(params.candidate)
  if (!policy.pass) return { action: 'hold', policy }
  return { action: 'write', policy, isGenerated: resolveImageSourceTier(params.candidate) === 'generated' }
}

/** prisma.product.update data 에 합칠 대표 사진 칸만 — 기존 쓰기 내용(base)을 결정에 맞춰 조정 */
export function applyAutoCoverDecisionToUpdateData<T extends Record<string, unknown>>(
  base: T,
  decision: AutoCoverDecision,
  measured: { width: number; height: number } | null
): T {
  if (decision.action === 'legacy') return base
  const out: Record<string, unknown> = { ...base }
  const coverKeys = Object.keys(out).filter((k) => k.startsWith('bgImage') && k !== 'bgImageRehostSearchLabel')
  if (decision.action === 'keep_existing_istock' || decision.action === 'hold') {
    for (const k of coverKeys) delete out[k]
    if (decision.action === 'hold') out.needsImageReview = true
    return out as T
  }
  // write: 출처 기록 칸은 새로 만들지 않음(Pexels·Unsplash·CC0 표시 의무 없음)
  delete out.bgImagePhotographer
  delete out.bgImageSourceUrl
  delete out.bgImageExternalId
  if (measured) {
    out.bgImageWidth = measured.width
    out.bgImageHeight = measured.height
  }
  out.bgImageIsGenerated = decision.isGenerated
  return out as T
}

export type AutoCoverPhotoLike = {
  url: string
  source?: string | null
  photographer?: string | null
  originalLink?: string | null
  externalId?: string | number | null
}

/**
 * process-images 의 prisma.product.update data 감싸기. 꺼져 있거나 범위 밖이면 data 그대로(측정·네트워크 없음).
 * 생성 이미지 prompt 는 메모리에서만 판정에 씀(DB prompt 칸 없음 — 사장님 결정 대기, 칸 추가 안 함).
 */
export async function gatedAutoCoverUpdateData<T extends Record<string, unknown>>(
  product: Record<string, unknown>,
  photo: AutoCoverPhotoLike,
  prompt: string | null,
  data: T,
  deps: {
    env?: Record<string, string | undefined>
    probe?: (url: string) => Promise<{ width: number; height: number } | null>
  } = {}
): Promise<T> {
  const enabled = isImagePolicyAutoRegisterEnabled(deps.env ?? process.env)
  const status = typeof product.registrationStatus === 'string' ? product.registrationStatus : null
  if (!enabled || !isImagePolicyAutoRegisterStatus(status)) return data
  const probe = deps.probe ?? (async (u: string) => (await import('@/lib/image-dimension-probe')).probeImageDimensions(u))
  const measured = photo.url ? await probe(photo.url) : null
  const isGen = /gemini|^generated$/i.test(String(photo.source ?? ''))
  const decision = decideAutoCoverWrite({
    enabled,
    registrationStatus: status,
    currentCoverUrl: typeof product.bgImageUrl === 'string' ? product.bgImageUrl : null,
    currentCoverSource: typeof product.bgImageSource === 'string' ? product.bgImageSource : null,
    candidate: {
      source: photo.source ?? null,
      url: photo.url,
      externalId: photo.externalId != null ? String(photo.externalId) : null,
      originalLink: photo.originalLink ?? null,
      photographer: photo.photographer ?? null,
      isGenerated: isGen,
      prompt: isGen ? prompt : null,
      width: measured?.width ?? null,
      height: measured?.height ?? null,
    },
  })
  if (decision.action === 'hold') {
    console.warn(`[image-policy] 대표 사진 보류 ${decision.policy.fails.join(',')}`)
  }
  return applyAutoCoverDecisionToUpdateData(data, decision, measured)
}
