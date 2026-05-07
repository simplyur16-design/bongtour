import { SolapiMessageService } from 'solapi'

import { KAKAO_TEMPLATES, type KakaoTemplateKey } from '@/lib/notifications/kakao-templates'

export type { KakaoTemplateKey }

export interface KakaoDispatchInput {
  /** 수신자 휴대폰 번호 (010-1234-5678 또는 01012345678) */
  to: string
  templateKey: KakaoTemplateKey
  /** 템플릿 변수 (#{name}, #{amount} 등 — 카카오·솔라피 등록 키와 일치해야 함) */
  variables: Record<string, string>
  userId?: string
  userEmail?: string
  /**
   * true면 알림톡 실패 시 문자 대체 발송 안 함.
   * 기본 false — 알림톡 수신 거부 등 대비 문자 폴백 허용(Solapi 동작).
   */
  disableSms?: boolean
}

export interface KakaoDispatchResult {
  ok: boolean
  dryRun: boolean
  providerMessageId?: string
  error?: string
}

/** `SOLAPI_KAKAO_DRY_RUN` 이 정확히 `'false'` 일 때만 실발송. 그 외(미설정·true·빈값 등)는 DRY_RUN. */
export function isSolapiKakaoDryRun(): boolean {
  const v = process.env.SOLAPI_KAKAO_DRY_RUN?.trim().toLowerCase()
  return v !== 'false'
}

function normalizeRecipientPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 12) return null
  return digits
}

function normalizeSenderPhone(raw: string | undefined): string | null {
  const digits = raw?.replace(/\D/g, '') ?? ''
  return digits.length > 0 ? digits : null
}

function resolveKakaoPfId(): string | undefined {
  const kakao = process.env.SOLAPI_KAKAO_PFID?.trim()
  if (kakao) return kakao
  return process.env.SOLAPI_PFID?.trim()
}

function extractProviderMessageId(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined
  const o = res as Record<string, unknown>
  const mid = o.messageId ?? o.message_id ?? o.groupId ?? o.group_id
  if (typeof mid === 'string' && mid.trim()) return mid.trim()
  return undefined
}

export async function sendKakaoNotification(input: KakaoDispatchInput): Promise<KakaoDispatchResult> {
  const spec = KAKAO_TEMPLATES[input.templateKey]
  if (!spec) {
    console.error('[kakao-notification] unknown_template_key', JSON.stringify({ templateKey: input.templateKey }))
    return { ok: false, dryRun: false, error: 'unknown_template_key' }
  }

  for (const key of spec.requiredVars) {
    const val = input.variables[key]
    if (typeof val !== 'string' || !val.trim()) {
      console.error(
        '[kakao-notification] missing_required_variable',
        JSON.stringify({ templateKey: input.templateKey, key, userId: input.userId }),
      )
      return { ok: false, dryRun: false, error: `missing_var:${key}` }
    }
  }

  const dryRun = isSolapiKakaoDryRun()
  if (dryRun) {
    console.log(
      '[kakao-dry-run]',
      JSON.stringify({
        templateKey: input.templateKey,
        to: input.to,
        variables: input.variables,
        userId: input.userId,
        userEmail: input.userEmail,
      }),
    )
    return { ok: true, dryRun: true }
  }

  const templateId = spec.templateId?.trim() ?? ''
  if (!templateId || templateId.startsWith('__TBD__')) {
    console.error(
      '[kakao-notification] template_not_configured',
      JSON.stringify({ templateKey: input.templateKey, userId: input.userId }),
    )
    return { ok: false, dryRun: false, error: 'template_not_configured' }
  }

  const to = normalizeRecipientPhone(input.to)
  if (!to) {
    console.error('[kakao-notification] invalid_phone', JSON.stringify({ templateKey: input.templateKey }))
    return { ok: false, dryRun: false, error: 'invalid_phone' }
  }

  const apiKey = process.env.SOLAPI_API_KEY?.trim()
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim()
  const pfId = resolveKakaoPfId()
  const from = normalizeSenderPhone(process.env.SOLAPI_FROM_PHONE?.trim())

  if (!apiKey || !apiSecret || !pfId || !from) {
    console.error(
      '[kakao-notification] missing_solapi_env',
      JSON.stringify({
        templateKey: input.templateKey,
        hasKey: Boolean(apiKey),
        hasSecret: Boolean(apiSecret),
        hasPfId: Boolean(pfId),
        hasFromPhone: Boolean(from),
      }),
    )
    return { ok: false, dryRun: false, error: 'solapi_env_incomplete' }
  }

  try {
    const svc = new SolapiMessageService(apiKey, apiSecret)
    const disableSms = input.disableSms === true
    const res = await svc.send({
      to,
      from,
      type: 'ATA',
      kakaoOptions: {
        pfId,
        templateId,
        variables: input.variables,
        disableSms,
      },
    })
    return {
      ok: true,
      dryRun: false,
      providerMessageId: extractProviderMessageId(res),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[kakao-notification] send_failed', JSON.stringify({ templateKey: input.templateKey, error: msg }))
    return { ok: false, dryRun: false, error: msg }
  }
}
