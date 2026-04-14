import 'server-only'

const DEV_AUTH_PLACEHOLDER = "__bongtour_dev_auth_secret_change_for_production__"

let warnedAdminBearerEnv = false

/** Next.js는 `process.env.NEXT_PUBLIC_*` 정적 접근을 빌드 시 인라인한다. 운영 호스트 `.env`만 바꿔도 기동 검증이 통과하도록 동적 키로 읽는다. */
const procEnv = process.env
function envTrim(key: string): string {
  return String((procEnv as Record<string, string | undefined>)[key] ?? "").trim()
}
function nextPublicTrim(suffix: string): string {
  return String((procEnv as Record<string, string | undefined>)["NEXT_PUBLIC_" + suffix] ?? "").trim()
}

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

  const site =
    envTrim("SITE_URL") ||
    nextPublicTrim("SITE_URL") ||
    envTrim("APP_URL") ||
    nextPublicTrim("APP_URL")
  const app =
    envTrim("APP_URL") ||
    nextPublicTrim("APP_URL") ||
    envTrim("SITE_URL") ||
    nextPublicTrim("SITE_URL")
  if (!site) {
    errors.push(
      miss(
        "NEXT_PUBLIC_SITE_URL",
        "공개 사이트 기준 URL이 필요합니다(Origin 검증 등). 서버만 설정할 때는 SITE_URL 또는 NEXT_PUBLIC_SITE_URL(또는 APP 계열)을 .env에 두세요. 클라이언트 번들에는 빌드 시점 NEXT_PUBLIC_*가 박히므로 URL 변경 시 재빌드가 필요합니다."
      )
    )
  }
  if (!app) {
    errors.push(
      miss(
        "NEXT_PUBLIC_APP_URL",
        "앱/관리 링크용 공개 URL이 필요합니다. 서버만 설정할 때는 APP_URL 또는 위 SITE_URL 계열과 동일 값을 쓰면 됩니다."
      )
    )
  }

  if (!(process.env.SUPABASE_URL ?? "").trim()) {
    errors.push(miss("SUPABASE_URL", "Supabase 연동에 필요합니다."))
  }
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()) {
    errors.push(miss("SUPABASE_SERVICE_ROLE_KEY", "서버 전용 Supabase 작업에 필요합니다."))
  }

  const gemini = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim()
  if (!gemini) {
    console.warn(
      "[server-env] GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 비어 있습니다. 관리자 Gemini·일부 파서 보강·이미지 생성은 동작하지 않을 수 있습니다. 기동은 계속합니다."
    )
  }

  const bearer = (process.env.ADMIN_SERVICE_BEARER_SECRET ?? "").trim()
  const legacyBypass = (process.env.ADMIN_BYPASS_SECRET ?? "").trim()
  if (!warnedAdminBearerEnv) {
    if (!bearer && !legacyBypass) {
      warnedAdminBearerEnv = true
      console.warn(
        "[server-env] ADMIN_SERVICE_BEARER_SECRET 과 ADMIN_BYPASS_SECRET 이 모두 비어 있습니다. Bearer로 /api/admin/* 를 호출하는 스케줄러는 동작하지 않습니다."
      )
    } else if (legacyBypass && !bearer) {
      warnedAdminBearerEnv = true
      if (process.env.BONGTOUR_LOG_ADMIN_SECRET_HINTS === "1" || process.env.NODE_ENV !== "production") {
        console.warn(
          "[server-env] ADMIN_SERVICE_BEARER_SECRET 미설정 — Bearer는 ADMIN_BYPASS_SECRET 폴백 중입니다. 분리 키(ADMIN_SERVICE_BEARER_SECRET) 설정을 권장합니다."
        )
      }
    }
  }

  if (errors.length > 0) {
    console.error("[server-env] process.cwd()=", process.cwd(), "(이 경로에 .env·.env.production 이 있어야 합니다)")
    throw new Error(
      `[Bong투어] 운영 환경 변수 검증 실패 — 서버를 중단합니다.\n\n${errors.join("\n")}\n\n.env.production 등을 확인하세요.`
    )
  }
}

