import { auth } from "@/auth";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getRateLimitStore } from "@/lib/rate-limit-store";
import { requestPressOtp } from "@/lib/bongsim/press/press-otp";

export const dynamic = "force-dynamic";

const PRESS_OTP_RATE_WINDOW_MS = 60_000;
const PRESS_OTP_RATE_MAX = 2;

function requestOtpMessage(reason: string): { message: string; status: number } {
  switch (reason) {
    case "invalid_email":
      return { message: "유효한 직장 이메일을 입력해 주세요.", status: 400 };
    case "domain_not_allowed":
      return {
        message: "허용된 언론사 직장 이메일 도메인만 인증할 수 있습니다.",
        status: 400,
      };
    case "marketing_consent_required":
      return {
        message: "마케팅 수신 동의 후 직군 인증을 진행할 수 있습니다.",
        status: 400,
      };
    case "already_verified":
      return { message: "이미 직군 인증이 완료된 계정입니다.", status: 400 };
    case "smtp_failed":
      return {
        message: "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
        status: 503,
      };
    case "db_unconfigured":
      return { message: "서비스를 일시적으로 이용할 수 없습니다.", status: 503 };
    default:
      return { message: "요청을 처리하지 못했습니다.", status: 500 };
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.mypage.press.request-otp", {
      status: 401,
    });
  }

  const store = getRateLimitStore();
  const bucket = await store.incr(`press-otp-request:${userId}`, PRESS_OTP_RATE_WINDOW_MS);
  if (bucket.count > PRESS_OTP_RATE_MAX) {
    return jsonWithLeakGuard(
      { error: "rate_limited", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      "bongsim.mypage.press.request-otp",
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard(
      { error: "invalid_json", message: "잘못된 요청입니다." },
      "bongsim.mypage.press.request-otp",
      { status: 400 },
    );
  }

  const o = body as Record<string, unknown>;
  const work_email = typeof o.work_email === "string" ? o.work_email : "";

  const result = await requestPressOtp(userId, work_email);
  if (!result.ok) {
    const { message, status } = requestOtpMessage(result.reason);
    return jsonWithLeakGuard({ error: result.reason, message }, "bongsim.mypage.press.request-otp", {
      status,
    });
  }

  return jsonWithLeakGuard({ ok: true }, "bongsim.mypage.press.request-otp");
}
