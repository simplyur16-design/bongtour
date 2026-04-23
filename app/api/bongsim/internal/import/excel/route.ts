import { NextResponse } from "next/server";
import { runExcelImportBuffer } from "@/lib/bongsim/ingest/run-excel-import";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isInternalRequestAuthorized, resolveInternalRouteSecret } from "@/lib/bongsim/runtime/internal-route-guard";

export async function POST(req: Request) {
  const sec = resolveInternalRouteSecret(process.env.BONGSIM_INTERNAL_IMPORT_SECRET);
  if (!sec.ok) {
    return NextResponse.json({ error: "import_secret_unconfigured" }, { status: 503 });
  }
  if (!isInternalRequestAuthorized(req.headers.get("x-bongsim-internal-secret"), sec.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!getPgPool()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = fd.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await runExcelImportBuffer(buf);

  if (!result.ok) {
    if (result.error === "db_unconfigured") {
      return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
    }
    if (result.error === "parse_failed") {
      return NextResponse.json({ error: "parse_failed", message: result.message }, { status: 400 });
    }
    if (result.error === "duplicate_import") {
      return NextResponse.json(
        { error: "duplicate_import", workbook_id: result.workbook_id, message: result.message },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "db_error", message: result.message }, { status: 500 });
  }

  return NextResponse.json({
    schema: "bongsim.import.excel.result.v1",
    workbook_id: result.workbook_id,
    rows_upserted: result.rows_upserted,
    rows_skipped: result.rows_skipped,
    price_events_written: result.price_events_written,
    sheet_stats: result.sheet_stats,
  });
}
