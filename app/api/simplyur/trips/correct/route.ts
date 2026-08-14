import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import {
  applySegmentCorrection,
  isTripParseStatus,
  learnFormParserFromCorrection,
  upsertFormParser,
  type TripFormParser,
  type TripParsedSegment,
  type TripSegmentPayload,
} from "@/lib/simplyur/trip-inbox";

export const dynamic = "force-dynamic";

/**
 * POST /api/simplyur/trips/correct
 * Body: { segment, patch, source_text?, form_parser? }
 * Customer correction updates the form parser for the next similar confirmation.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: correction API — manifest
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: learnFormParserFromCorrection — manifest
 */
export async function POST(req: Request) {
  const user = await resolveSimplyurApiUser(req);
  if (!user?.email && !user?.userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "simplyur.trips.correct", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "simplyur.trips.correct", { status: 400 });
  }

  const seg = (body as { segment?: unknown })?.segment;
  const patch = (body as { patch?: unknown })?.patch;
  if (!seg || typeof seg !== "object" || !patch || typeof patch !== "object") {
    return jsonWithLeakGuard({ error: "invalid_body" }, "simplyur.trips.correct", { status: 400 });
  }

  const current = seg as TripParsedSegment;
  if (!current.temp_id || !current.payload?.type) {
    return jsonWithLeakGuard({ error: "invalid_segment" }, "simplyur.trips.correct", { status: 400 });
  }
  if (current.status && !isTripParseStatus(current.status)) {
    return jsonWithLeakGuard({ error: "invalid_status" }, "simplyur.trips.correct", { status: 400 });
  }

  const p = patch as {
    payload?: Partial<TripSegmentPayload>;
    sort_at?: string | null;
  };

  const next = applySegmentCorrection(current, {
    payload: p.payload,
    sort_at: p.sort_at,
  });

  const sourceText =
    body && typeof body === "object" && typeof (body as { source_text?: unknown }).source_text === "string"
      ? (body as { source_text: string }).source_text
      : "";
  const existing =
    body && typeof body === "object" && (body as { form_parser?: unknown }).form_parser
      ? ((body as { form_parser: TripFormParser }).form_parser)
      : null;
  if (existing?.form_id) upsertFormParser(existing);

  let formParser: TripFormParser | null = existing;
  if (sourceText.trim()) {
    formParser = learnFormParserFromCorrection({
      sourceText,
      before: current,
      after: next,
      existing,
    });
  }

  return jsonWithLeakGuard({ segment: next, form_parser: formParser }, "simplyur.trips.correct");
}
