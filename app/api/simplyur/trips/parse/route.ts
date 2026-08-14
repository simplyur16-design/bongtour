import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { parseTripInboxText, extractPdfText, type TripFormParser } from "@/lib/simplyur/trip-inbox";

export const dynamic = "force-dynamic";

const MAX_TEXT = 200_000;
const MAX_PDF_BYTES = 6_000_000;

function decodePdfBase64(raw: string): Uint8Array {
  const trimmed = raw.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  const buf = Buffer.from(trimmed, "base64");
  if (!buf.length) throw new Error("empty_pdf");
  if (buf.length > MAX_PDF_BYTES) throw new Error("pdf_too_large");
  return new Uint8Array(buf);
}

/**
 * POST /api/simplyur/trips/parse
 * Body: { text?: string, pdfBase64?: string, formParsers?: TripFormParser[] }
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: parse API — manifest
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: pdfBase64 + formParsers — manifest
 */
export async function POST(req: Request) {
  const user = await resolveSimplyurApiUser(req);
  if (!user?.email && !user?.userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "simplyur.trips.parse", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "simplyur.trips.parse", { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  let text = typeof obj.text === "string" ? obj.text : "";
  const pdfBase64 = typeof obj.pdfBase64 === "string" ? obj.pdfBase64 : "";
  const formParsers = Array.isArray(obj.formParsers) ? (obj.formParsers as TripFormParser[]) : undefined;

  if (pdfBase64) {
    try {
      const extracted = extractPdfText(decodePdfBase64(pdfBase64));
      if (!extracted.trim()) {
        return jsonWithLeakGuard({ error: "pdf_no_text" }, "simplyur.trips.parse", { status: 422 });
      }
      text = text.trim() ? `${text.trim()}\n${extracted}` : extracted;
    } catch (e) {
      const code = e instanceof Error ? e.message : "pdf_failed";
      const status = code === "pdf_too_large" ? 413 : 400;
      return jsonWithLeakGuard({ error: code }, "simplyur.trips.parse", { status });
    }
  }

  if (!text.trim()) {
    return jsonWithLeakGuard({ error: "empty_text" }, "simplyur.trips.parse", { status: 400 });
  }

  if (text.length > MAX_TEXT) {
    return jsonWithLeakGuard({ error: "text_too_large" }, "simplyur.trips.parse", { status: 413 });
  }

  const result = parseTripInboxText(text, { formParsers });
  return jsonWithLeakGuard({ ...result, source_text: text.slice(0, 80_000) }, "simplyur.trips.parse");
}
