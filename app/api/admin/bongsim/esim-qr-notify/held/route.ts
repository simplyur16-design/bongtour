import { NextResponse } from "next/server";
import { listHeldEsimQrNotify, releaseHeldEsimQrNotify } from "@/lib/bongsim/admin/esim-qr-notify-hold-admin";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listHeldEsimQrNotify();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: unknown };
  try {
    body = (await req.json()) as { id?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const released = await releaseHeldEsimQrNotify(id);
  if (!released) return NextResponse.json({ error: "not_held" }, { status: 404 });
  return NextResponse.json({ ok: true, id });
}
