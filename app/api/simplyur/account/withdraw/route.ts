import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { withdrawSimplyurAccount } from "@/lib/simplyur/auth/withdraw-simplyur-account";

export const dynamic = "force-dynamic";

/**
 * POST /api/simplyur/account/withdraw — App Store account deletion.
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: withdraw API — manifest
 */
export async function POST(req: Request) {
  const user = await resolveSimplyurApiUser(req);
  if (!user?.userId) {
    return jsonWithLeakGuard({ error: "login_required" }, "simplyur.account.withdraw", {
      status: 401,
    });
  }

  const result = await withdrawSimplyurAccount(user.userId);
  if (result.ok) {
    return jsonWithLeakGuard({ ok: true }, "simplyur.account.withdraw");
  }

  const status =
    result.code === "not_found"
      ? 404
      : result.code === "already_withdrawn"
        ? 409
        : 403;
  return jsonWithLeakGuard(
    { error: result.code },
    "simplyur.account.withdraw",
    { status },
  );
}
