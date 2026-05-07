import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { runExcelImportBuffer } from "@/lib/bongsim/ingest/run-excel-import";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isInternalRequestAuthorized, resolveInternalRouteSecret } from "@/lib/bongsim/runtime/internal-route-guard";

export async function POST(req: Request) {
  const sec = resolveInternalRouteSecret(process.env.BONGSIM_INTERNAL_IMPORT_SECRET);
  if (!sec.ok) {
    return jsonWithLeakGuard({ error: "import_secret_unconfigured" }, "bongsim.internal.import.excel", { status: 503 });
  }
  if (!isInternalRequestAuthorized(req.headers.get("x-bongsim-internal-secret"), sec.secret)) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.internal.import.excel", { status: 401 });
  }
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.internal.import.excel", { status: 503 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return jsonWithLeakGuard({ error: "invalid_multipart" }, "bongsim.internal.import.excel", { status: 400 });
  }

  const file = fd.get("file");
  if (!file || !(file instanceof Blob)) {
    return jsonWithLeakGuard({ error: "file_required" }, "bongsim.internal.import.excel", { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await runExcelImportBuffer(buf);

  if (!result.ok) {
    if (result.error === "db_unconfigured") {
      return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.internal.import.excel", { status: 503 });
    }
    if (result.error === "parse_failed") {
      return jsonWithLeakGuard(
        { error: "parse_failed", message: result.message },
        "bongsim.internal.import.excel",
        { status: 400 },
      );
    }
    if (result.error === "duplicate_import") {
      return jsonWithLeakGuard(
        { error: "duplicate_import", workbook_id: result.workbook_id, message: result.message },
        "bongsim.internal.import.excel",
        { status: 409 },
      );
    }
    return jsonWithLeakGuard({ error: "db_error", message: result.message }, "bongsim.internal.import.excel", {
      status: 500,
    });
  }

  return jsonWithLeakGuard(
    {
      schema: "bongsim.import.excel.result.v1",
      workbook_id: result.workbook_id,
      rows_upserted: result.rows_upserted,
      rows_skipped: result.rows_skipped,
      price_events_written: result.price_events_written,
      sheet_stats: result.sheet_stats,
    },
    "bongsim.internal.import.excel",
  );
}
