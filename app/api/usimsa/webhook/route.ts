import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function summarizePayload(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { shape: typeof body };
  }

  const o = body as Record<string, unknown>;

  return {
    keys: Object.keys(o),
    hasTopupId: typeof o.topupId === "string",
    hasOptionId: typeof o.optionId === "string",
    hasIccid: typeof o.iccid === "string",
  };
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  console.info("[usimsa:webhook]", summarizePayload(body));

  return NextResponse.json({ ok: true as const }, { status: 200 });
}
