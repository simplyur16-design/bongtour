import { NextResponse } from "next/server";
import { adminGrantComplimentaryEsimBulk } from "@/lib/bongsim/admin/complimentary-esim-order";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
// REGRESSION-FREEZE[bongsim-complimentary-esim-bulk]: 단체 일괄은 인원×발급으로 길어짐 — 빈 응답 JSON 파싱 방지용 — manifest
export const maxDuration = 300;

type Body = {
  option_api_id?: unknown;
  reason_category?: unknown;
  reason_memo?: unknown;
  phones?: unknown;
  phones_text?: unknown;
};

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const option_api_id = typeof body.option_api_id === "string" ? body.option_api_id.trim() : "";
  const reason_category = typeof body.reason_category === "string" ? body.reason_category : "";
  const reason_memo = typeof body.reason_memo === "string" ? body.reason_memo : "";
  const adminId = (admin.user as { id?: string }).id?.trim() || admin.user.role || "admin";

  let phones: string | string[] = "";
  if (Array.isArray(body.phones)) {
    phones = body.phones.filter((p): p is string => typeof p === "string");
  } else if (typeof body.phones_text === "string") {
    phones = body.phones_text;
  } else if (typeof body.phones === "string") {
    phones = body.phones;
  }

  const result = await adminGrantComplimentaryEsimBulk({
    option_api_id,
    reason_category,
    reason_memo,
    admin_id: String(adminId),
    phones,
  });

  if (!result.ok) {
    const status =
      result.reason === "product_not_found"
        ? 404
        : result.reason === "db_unconfigured" || result.reason === "connection_timeout"
          ? 503
          : result.reason === "db_error"
            ? 500
            : 400;
    return NextResponse.json(
      {
        error: result.reason,
        message: result.message,
        invalid_phones: result.invalid_phones ?? [],
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    requested: result.requested,
    succeeded: result.succeeded,
    failed: result.failed,
    invalid_phones: result.invalid_phones,
    results: result.results,
  });
}
