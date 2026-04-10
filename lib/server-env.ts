import 'server-only'

const DEV_AUTH_PLACEHOLDER = "__bongtour_dev_auth_secret_change_for_production__"

function miss(name: string, hint: string): string {
  return `${name}: ${hint}`
}

/** 프로덕션 Node 서버 기동 시 필수 env 누락 시 즉시 실패 */
export function assertProductionServerEnv(): void {
  if (process.env.NODE_ENV !== "production") return
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const errors: string[] = []

  const auth = (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim()
  if (!auth || auth === DEV_AUTH_PLACEHOLDER) {
    errors.push(miss("AUTH_SECRET / NEXTAUTH_SECRET", "운영 JWT 서명용 강한 비밀값이 필요합니다."))
  }

  if (!(process.env.NEXTAUTH_URL ?? "").trim()) {
    errors.push(miss("NEXTAUTH_URL", "절대 URL(예: https://bongtour.com)이 필요합니다."))
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim()
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim()
  if (!site) {
    errors.push(miss("NEXT_PUBLIC_SITE_URL", "공개 사이트 기준 URL이 필요합니다(Origin 검증 등)."))
  }
  if (!app) {
    errors.push(miss("NEXT_PUBLIC_APP_URL", "앱/관리 링크용 공개 URL이 필요합니다."))
  }

  if (!(process.env.SUPABASE_URL ?? "").trim()) {
    errors.push(miss("SUPABASE_URL", "Supabase 연동에 필요합니다."))
  }
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) {
    errors.push(miss("SUPABASE_SERVICE_ROLE_KEY", "서버 전용 Supabase 작업에 필요합니다."))
  }

  if (!(process.env.GEMINI_API_KEY ?? "").trim()) {
    errors.push(miss("GEMINI_API_KEY", "Gemini 호출 경로에 필요합니다."))
  }

  const bearer = (process.env.ADMIN_SERVICE_BEARER_SECRET ?? "").trim()
  const legacyBypass = (process.env.ADMIN_BYPASS_SECRET ?? "").trim()
  const devBypassNew = (process.env.DEV_ADMIN_BYPASS_SECRET ?? "").trim()
  if (!devBypassNew && !bearer) {
    console.warn(
      "[server-env] DEV_ADMIN_BYPASS_SECRET 과 ADMIN_SERVICE_BEARER_SECRET 가 모두 비어 있습니다. 운영 이관 중이면 ADMIN_BYPASS_SECRET 로 폴백됩니다(lib/admin-secrets). 분리 키 설정을 권장합니다."
    )
  }
  if (!bearer && !legacyBypass) {
    console.warn(
      "[server-env] ADMIN_SERVICE_BEARER_SECRET 과 ADMIN_BYPASS_SECRET 이 모두 비어 있습니다. Bearer로 /api/admin/* 를 호출하는 스케줄러는 동작하지 않습니다."
    )
  } else if (legacyBypass && !bearer) {
    console.warn(
      "[server-env] ADMIN_SERVICE_BEARER_SECRET 를 설정하고 ADMIN_BYPASS_SECRET(Bearer) 의존을 제거하는 것을 권장합니다."
    )
  }

  if (errors.length > 0) {
    throw new Error(
      `[Bong투어] 운영 환경 변수 검증 실패 — 서버를 중단합니다.\n\n${errors.join("\n")}\n\n.env.production 등을 확인하세요.`
    )
  }
}

