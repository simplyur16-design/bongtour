/** Timeline merge / dedupe keys */
import type { TripSegmentPayload } from "@/lib/simplyur/trip-inbox/types";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function dayKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

export function buildMergeKey(payload: TripSegmentPayload): string | null {
  if (payload.type === "flight") {
    const fn = norm(payload.flight_no);
    const day = dayKey(payload.dep_at);
    const dep = norm(payload.dep_airport) || norm(payload.dep_city);
    const arr = norm(payload.arr_airport) || norm(payload.arr_city);
    if (!fn || !day) return null;
    return `flight|${fn}|${day}|${dep}|${arr}`;
  }
  if (payload.type === "hotel") {
    const name = norm(payload.property_name);
    const day = dayKey(payload.check_in_at);
    const ref = norm(payload.booking_ref);
    if (!name || !day) return null;
    return `hotel|${name}|${day}|${ref}`;
  }
  if (payload.type === "experience") {
    const title = norm(payload.title);
    const day = dayKey(payload.start_at);
    const ref = norm(payload.booking_ref);
    if (!title || !day) return null;
    return `experience|${title}|${day}|${ref}`;
  }
  const loc = norm(payload.pickup_location);
  const day = dayKey(payload.pickup_at);
  const ref = norm(payload.booking_ref);
  if (!loc || !day) return null;
  return `car|${loc}|${day}|${ref}`;
}
