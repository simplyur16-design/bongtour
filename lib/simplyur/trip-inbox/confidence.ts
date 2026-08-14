/**
 * Confidence + needs_review rules after parse / correction.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: review gate — manifest
 */
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import type {
  TripCarSegmentPayload,
  TripExperienceSegmentPayload,
  TripFlightSegmentPayload,
  TripHotelSegmentPayload,
  TripParsedSegment,
  TripParseStatus,
  TripSegmentPayload,
} from "@/lib/simplyur/trip-inbox/types";

function nonempty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function parseInstant(iso: string | null | undefined): number | null {
  if (!nonempty(iso)) return null;
  const t = Date.parse(iso!);
  return Number.isFinite(t) ? t : null;
}

export function collectSegmentIssues(payload: TripSegmentPayload): string[] {
  const issues: string[] = [];
  if (payload.type === "flight") {
    const p = payload as TripFlightSegmentPayload;
    if (!nonempty(p.flight_no)) issues.push("payload.flight_no");
    if (!nonempty(p.dep_airport) && !nonempty(p.dep_city)) issues.push("payload.dep_airport");
    if (!nonempty(p.arr_airport) && !nonempty(p.arr_city)) issues.push("payload.arr_airport");
    if (!nonempty(p.dep_at)) issues.push("payload.dep_at");
    const dep = parseInstant(p.dep_at);
    const arr = parseInstant(p.arr_at);
    if (dep != null && arr != null && arr < dep) issues.push("payload.arr_at_before_dep");
  } else if (payload.type === "hotel") {
    const p = payload as TripHotelSegmentPayload;
    if (!nonempty(p.property_name)) issues.push("payload.property_name");
    if (!nonempty(p.check_in_at)) issues.push("payload.check_in_at");
    if (!nonempty(p.check_out_at)) issues.push("payload.check_out_at");
    const a = parseInstant(p.check_in_at);
    const b = parseInstant(p.check_out_at);
    if (a != null && b != null && b < a) issues.push("payload.check_out_before_in");
  } else if (payload.type === "car") {
    const p = payload as TripCarSegmentPayload;
    if (!nonempty(p.pickup_at)) issues.push("payload.pickup_at");
    if (!nonempty(p.pickup_location)) issues.push("payload.pickup_location");
  } else if (payload.type === "experience") {
    const p = payload as TripExperienceSegmentPayload;
    if (!nonempty(p.title)) issues.push("payload.title");
    if (!nonempty(p.start_at)) issues.push("payload.start_at");
  }
  return issues;
}

export function scoreSegmentConfidence(payload: TripSegmentPayload, base = 0.55): number {
  const issues = collectSegmentIssues(payload);
  let score = base;
  if (payload.type === "flight") {
    const p = payload as TripFlightSegmentPayload;
    if (nonempty(p.flight_no)) score += 0.12;
    if (nonempty(p.dep_airport) || nonempty(p.dep_city)) score += 0.08;
    if (nonempty(p.arr_airport) || nonempty(p.arr_city)) score += 0.08;
    if (nonempty(p.dep_at)) score += 0.1;
    if (nonempty(p.pnr) || nonempty(p.booking_ref)) score += 0.05;
  } else if (payload.type === "hotel") {
    const p = payload as TripHotelSegmentPayload;
    if (nonempty(p.property_name)) score += 0.15;
    if (nonempty(p.check_in_at)) score += 0.12;
    if (nonempty(p.check_out_at)) score += 0.1;
    if (nonempty(p.booking_ref)) score += 0.05;
  } else if (payload.type === "experience") {
    const p = payload as TripExperienceSegmentPayload;
    if (nonempty(p.title)) score += 0.18;
    if (nonempty(p.start_at)) score += 0.15;
    if (nonempty(p.booking_ref)) score += 0.05;
  } else {
    const p = payload as TripCarSegmentPayload;
    if (nonempty(p.pickup_at)) score += 0.15;
    if (nonempty(p.pickup_location)) score += 0.12;
    if (nonempty(p.vehicle_class)) score += 0.08;
  }
  score -= issues.length * 0.12;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export function resolveParseStatus(
  issues: string[],
  confidence: number,
  opts?: { userCorrected?: boolean },
): TripParseStatus {
  if (opts?.userCorrected && issues.length === 0) return "confirmed";
  if (issues.length === 0 && confidence >= 0.75) return "confirmed";
  if (issues.length >= 3 || confidence < 0.35) return "failed";
  return "needs_review";
}

export function finalizeParsedSegment(
  seg: Omit<TripParsedSegment, "issues" | "status" | "confidence"> & {
    issues?: string[];
    status?: TripParseStatus;
    confidence?: number;
    userCorrected?: boolean;
  },
): TripParsedSegment {
  const issues = seg.issues ?? collectSegmentIssues(seg.payload);
  const confidence = seg.confidence ?? scoreSegmentConfidence(seg.payload);
  const status =
    seg.status ??
    resolveParseStatus(issues, confidence, { userCorrected: seg.userCorrected });
  return {
    temp_id: seg.temp_id,
    type: seg.type,
    provider: seg.provider,
    status,
    confidence,
    sort_at: seg.sort_at,
    merge_key: seg.merge_key,
    payload: seg.payload,
    issues,
    source_fingerprint: seg.source_fingerprint ?? null,
    form_id: seg.form_id ?? null,
  };
}

export function applySegmentCorrection(
  current: TripParsedSegment,
  patch: { payload?: Partial<TripSegmentPayload>; sort_at?: string | null },
): TripParsedSegment {
  let nextPayload = {
    ...current.payload,
    ...(patch.payload ?? {}),
    type: current.payload.type,
  } as TripSegmentPayload;
  if (nextPayload.type === "hotel") {
    nextPayload = enrichHotelBilingual(nextPayload as TripHotelSegmentPayload);
  }
  const sortAt =
    patch.sort_at !== undefined
      ? patch.sort_at
      : nextPayload.type === "flight"
        ? nextPayload.dep_at
        : nextPayload.type === "hotel"
          ? nextPayload.check_in_at
          : nextPayload.type === "experience"
            ? nextPayload.start_at
            : nextPayload.pickup_at;
  return finalizeParsedSegment({
    ...current,
    sort_at: sortAt,
    payload: nextPayload,
    userCorrected: true,
  });
}
