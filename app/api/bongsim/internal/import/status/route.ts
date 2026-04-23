import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isInternalRequestAuthorized, resolveInternalRouteSecret } from "@/lib/bongsim/runtime/internal-route-guard";

type AuditRow = {
  id: string;
  workbook_id: string;
  rows_upserted: number;
  rows_skipped: number;
  price_events_written: number;
  sheet_stats: unknown;
  error_message: string | null;
  completed_at: string;
};

export async function GET(req: Request) {
  const sec = resolveInternalRouteSecret(process.env.BONGSIM_INTERNAL_IMPORT_SECRET);
  if (!sec.ok) {
    return NextResponse.json({ error: "import_secret_unconfigured" }, { status: 503 });
  }
  if (!isInternalRequestAuthorized(req.headers.get("x-bongsim-internal-secret"), sec.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getPgPool();
  if (!pool) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }

  const u = new URL(req.url);
  const workbookId = (u.searchParams.get("workbook_id") ?? "").trim();

  try {
    const r = workbookId
      ? await pool.query<AuditRow>(
          `SELECT id, workbook_id, rows_upserted, rows_skipped, price_events_written, sheet_stats, error_message,
                  completed_at::text AS completed_at
           FROM bongsim_import_audit
           WHERE workbook_id = $1
           ORDER BY completed_at DESC
           LIMIT 1`,
          [workbookId],
        )
      : await pool.query<AuditRow>(
          `SELECT id, workbook_id, rows_upserted, rows_skipped, price_events_written, sheet_stats, error_message,
                  completed_at::text AS completed_at
           FROM bongsim_import_audit
           ORDER BY completed_at DESC
           LIMIT 1`,
        );

    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({ schema: "bongsim.import.audit.v1", row: null });
    }
    return NextResponse.json({ schema: "bongsim.import.audit.v1", row });
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
