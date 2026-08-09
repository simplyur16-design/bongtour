import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { upsertSimplyurDevicePushToken } from "@/lib/simplyur/push/upsert-device-token";

export const dynamic = "force-dynamic";

/**
 * POST /api/simplyur/account/device-token — Expo push token upsert.
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: device-token API — manifest
 */
export async function POST(req: Request) {
  const user = await resolveSimplyurApiUser(req);
  if (!user?.userId) {
    return jsonWithLeakGuard({ error: "login_required" }, "simplyur.account.device_token", {
      status: 401,
    });
  }

  let body: { token?: unknown; platform?: unknown } = {};
  try {
    body = (await req.json()) as { token?: unknown; platform?: unknown };
  } catch {
    body = {};
  }

  const result = await upsertSimplyurDevicePushToken({
    userId: user.userId,
    token: typeof body.token === "string" ? body.token : "",
    platform: typeof body.platform === "string" ? body.platform : "",
  });
  if (!result.ok) {
    return jsonWithLeakGuard({ error: result.code }, "simplyur.account.device_token", {
      status: 400,
    });
  }
  return jsonWithLeakGuard({ ok: true }, "simplyur.account.device_token");
}
