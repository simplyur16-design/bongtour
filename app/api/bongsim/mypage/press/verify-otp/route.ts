import { auth } from "@/auth";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { verifyPressOtp } from "@/lib/bongsim/press/press-otp";

export const dynamic = "force-dynamic";

function verifyOtpMessage(
  reason: string,
  attemptsRemaining?: number,
): { message: string; status: number } {
  switch (reason) {
    case "invalid_email":
      return { message: "유효한 직장 이메일을 입력해 주세요.", status: 400 };
    case "domain_not_allowed":
      return {
        message: "허용된 언론사 직장 이메일 도메인만 인증할 수 있습니다.",
        status: 400,
      };
    case "no_active_otp":
      return { message: "인증번호를 먼저 요청해 주세요.", status: 400 };
    case "expired":
      return { message: "인증번호가 만료되었습니다. 다시 요청해 주세요.", status: 400 };
    case "locked":
      return {
        message: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요.",
        status: 400,
      };
    case "invalid_code":
      if (attemptsRemaining != null && attemptsRemaining > 0) {
        return {
          message: `인증번호가 올바르지 않습니다. (${attemptsRemaining}회 남음)`,
          status: 400,
        };
      }
      return { message: "인증번호가 올바르지 않습니다.", status: 400 };
    case "db_unconfigured":
      return { message: "서비스를 일시적으로 이용할 수 없습니다.", status: 503 };
    default:
      return { message: "인증에 실패했습니다.", status: 500 };
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  if (!userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.mypage.press.verify-otp", {
      status: 401,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard(
      { error: "invalid_json", message: "잘못된 요청입니다." },
      "bongsim.mypage.press.verify-otp",
      { status: 400 },
    );
  }

  const o = body as Record<string, unknown>;
  const work_email = typeof o.work_email === "string" ? o.work_email : "";
  const code = typeof o.code === "string" ? o.code : "";

  const result = await verifyPressOtp(userId, work_email, code);
  if (!result.ok) {
    const { message, status } = verifyOtpMessage(result.reason, result.attemptsRemaining);
    return jsonWithLeakGuard(
      {
        error: result.reason,
        message,
        ...(result.attemptsRemaining != null ? { attemptsRemaining: result.attemptsRemaining } : {}),
      },
      "bongsim.mypage.press.verify-otp",
      { status },
    );
  }

  return jsonWithLeakGuard(
    {
      ok: true,
      pressVerified: true,
      pressVerifiedEmail: result.pressVerifiedEmail,
      pressVerifiedDomain: result.pressVerifiedDomain,
    },
    "bongsim.mypage.press.verify-otp",
  );
}
