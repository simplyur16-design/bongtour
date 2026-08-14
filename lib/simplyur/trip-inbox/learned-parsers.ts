/**
 * Instant form parsers: mine a layout on first upload, then update from customer corrections.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: mine + learnFromCorrection — manifest
 */
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import {
  collectFormLabelKeys,
  fingerprintTripForm,
  formIdFromFingerprint,
} from "@/lib/simplyur/trip-inbox/form-fingerprint";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import { newTempId, parseEnDateOptionalTime, parseIsoLikeLocal, parseKoDateOptionalTime, toIsoLocal } from "@/lib/simplyur/trip-inbox/date-parse";
import type {
  TripFormFieldRule,
  TripFormParser,
  TripHotelSegmentPayload,
  TripParsedSegment,
  TripProvider,
  TripSegmentPayload,
  TripSegmentType,
} from "@/lib/simplyur/trip-inbox/types";

const memoryForms = new Map<string, TripFormParser>();

const LABEL_TO_FIELD: Array<{ re: RegExp; field: string; type: TripSegmentType }> = [
  { re: /^(?:flight(?:\s*(?:no|number|#))?|편명|항공편)$/i, field: "flight_no", type: "flight" },
  { re: /^(?:airline|항공사)$/i, field: "airline", type: "flight" },
  { re: /^(?:pnr|booking reference)$/i, field: "pnr", type: "flight" },
  { re: /^(?:ticket(?:\s*number)?|e-?ticket|항공권(?:\s*번호)?)$/i, field: "ticket_number", type: "flight" },
  { re: /^(?:from|departure|출발)$/i, field: "dep_city", type: "flight" },
  { re: /^(?:to|arrival|도착)$/i, field: "arr_city", type: "flight" },
  { re: /^(?:hotel|property|listing|venue|숙소명|호텔명|시설명|property title)$/i, field: "property_name", type: "hotel" },
  { re: /^(?:address|주소)$/i, field: "address", type: "hotel" },
  { re: /^(?:check[- ]?in|arrival(?:\s+date)?|in date|체크인)$/i, field: "check_in_at", type: "hotel" },
  { re: /^(?:check[- ]?out|departure(?:\s+date)?|out date|체크아웃)$/i, field: "check_out_at", type: "hotel" },
  { re: /^(?:confirmation(?:\s+(?:code|number))?|booking(?:\s*(?:id|number|#))?|reservation(?:\s*no)?|book code|예약\s*(?:번호|id|코드)|확인\s*코드)$/i, field: "booking_ref", type: "hotel" },
  { re: /^(?:activity|experience|tour|attraction|상품명|체험)$/i, field: "title", type: "experience" },
  { re: /^(?:venue|meeting point)$/i, field: "venue", type: "experience" },
  { re: /^(?:pick[- ]?up|인수)$/i, field: "pickup_location", type: "car" },
  { re: /^(?:drop[- ]?off|반납)$/i, field: "dropoff_location", type: "car" },
  { re: /^(?:vehicle|car|차종)$/i, field: "vehicle_class", type: "car" },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function upsertFormParser(parser: TripFormParser): TripFormParser {
  memoryForms.set(parser.form_id, parser);
  memoryForms.set(parser.fingerprint, parser);
  return parser;
}

export function getFormParserByFingerprint(fingerprint: string): TripFormParser | undefined {
  return memoryForms.get(fingerprint);
}

export function getFormParserById(formId: string): TripFormParser | undefined {
  return memoryForms.get(formId);
}

export function listFormParsers(): TripFormParser[] {
  const seen = new Set<string>();
  const out: TripFormParser[] = [];
  for (const p of memoryForms.values()) {
    if (seen.has(p.form_id)) continue;
    seen.add(p.form_id);
    out.push(p);
  }
  return out;
}

export function resetFormParsersForTests(): void {
  memoryForms.clear();
}

function guessSegmentType(labels: string[], text: string): TripSegmentType {
  if (labels.includes("flight") || labels.includes("ticket") || /e-?ticket|편명/i.test(text)) return "flight";
  if (labels.includes("pickup") || labels.includes("dropoff") || /렌터카|rental\s*car/i.test(text)) return "car";
  if (/klook|kkday|getyourguide|viator|activity|experience|체험/i.test(text)) return "experience";
  return "hotel";
}

function emptyPayload(type: TripSegmentType): TripSegmentPayload {
  if (type === "flight") {
    return {
      type: "flight",
      flight_no: null,
      airline: null,
      operated_by: null,
      dep_airport: null,
      arr_airport: null,
      dep_city: null,
      arr_city: null,
      dep_terminal: null,
      arr_terminal: null,
      dep_at: null,
      arr_at: null,
      cabin_class: null,
      status: null,
      duration: null,
      aircraft: null,
      baggage: null,
      pnr: null,
      ticket_number: null,
      booking_ref: null,
      travelers: [],
    };
  }
  if (type === "hotel") {
    return {
      type: "hotel",
      property_name: null,
      property_name_user: null,
      property_name_dest: null,
      address: null,
      address_user: null,
      address_dest: null,
      dest_lang: null,
      phone: null,
      check_in_at: null,
      check_out_at: null,
      check_in_window: null,
      rooms: null,
      room_type: null,
      guests_adults: null,
      guests_children: null,
      pay_at: null,
      booking_ref: null,
      travelers: [],
    };
  }
  if (type === "experience") {
    return {
      type: "experience",
      title: null,
      venue: null,
      address: null,
      start_at: null,
      end_at: null,
      booking_ref: null,
      travelers: [],
    };
  }
  return {
    type: "car",
    vehicle_class: null,
    pickup_at: null,
    dropoff_at: null,
    pickup_location: null,
    dropoff_location: null,
    branch_phone: null,
    booking_ref: null,
    travelers: [],
  };
}

function coerceFieldValue(field: string, raw: string): string {
  const v = raw.replace(/\s+/g, " ").trim().split(/\n/)[0]!.trim();
  if (/(_at|check_in|check_out|pickup_at|dropoff_at|dep_at|arr_at)$/.test(field)) {
    const iso = parseIsoLikeLocal(v);
    if (iso) return iso;
    const en = parseEnDateOptionalTime(v);
    if (en) return toIsoLocal(en.date, en.time, field.includes("out") ? "11:00" : "14:00");
    const ko = parseKoDateOptionalTime(v);
    if (ko) return toIsoLocal(ko.date, ko.time, field.includes("out") ? "11:00" : "14:00");
  }
  return v;
}

export function applyFormRulesToPayload(
  payload: TripSegmentPayload,
  text: string,
  rules: TripFormFieldRule[],
): TripSegmentPayload {
  const next = { ...payload } as Record<string, unknown>;
  for (const rule of rules) {
    if (!(rule.field in next)) continue;
    const cur = next[rule.field];
    if (typeof cur === "string" && cur.trim()) continue;
    if (typeof cur === "number" && Number.isFinite(cur)) continue;
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, rule.flags ?? "im");
    } catch {
      continue;
    }
    const m = text.match(re);
    const cap = m?.[1]?.trim();
    if (!cap) continue;
    next[rule.field] = coerceFieldValue(rule.field, cap);
  }
  if (next.type === "hotel") {
    return enrichHotelBilingual(next as unknown as TripHotelSegmentPayload);
  }
  return next as unknown as TripSegmentPayload;
}

function sortAtFromPayload(payload: TripSegmentPayload): string | null {
  if (payload.type === "flight") return payload.dep_at;
  if (payload.type === "hotel") return payload.check_in_at;
  if (payload.type === "experience") return payload.start_at;
  return payload.pickup_at;
}

export function applyFormParser(parser: TripFormParser, text: string): TripParsedSegment[] {
  const payload = applyFormRulesToPayload(emptyPayload(parser.segment_type), text, parser.rules);
  const sortAt = sortAtFromPayload(payload);
  return [
    finalizeParsedSegment({
      temp_id: newTempId("frm"),
      type: parser.segment_type,
      provider: parser.provider === "unknown" ? "learned_form" : parser.provider,
      sort_at: sortAt,
      merge_key: buildMergeKey(payload),
      payload,
      form_id: parser.form_id,
      source_fingerprint: parser.fingerprint,
    }),
  ];
}

export function fillSegmentsFromFormParser(
  segments: TripParsedSegment[],
  parser: TripFormParser,
  text: string,
): TripParsedSegment[] {
  return segments.map((seg) => {
    const payload = applyFormRulesToPayload(seg.payload, text, parser.rules);
    const sortAt = sortAtFromPayload(payload) ?? seg.sort_at;
    return finalizeParsedSegment({
      ...seg,
      payload,
      sort_at: sortAt,
      merge_key: buildMergeKey(payload),
      form_id: parser.form_id,
      source_fingerprint: parser.fingerprint,
    });
  });
}

function matchLabelField(label: string): { field: string; type: TripSegmentType } | null {
  const n = label.replace(/\s+/g, " ").trim();
  for (const row of LABEL_TO_FIELD) {
    if (row.re.test(n)) return { field: row.field, type: row.type };
  }
  return null;
}

/** Build a parser immediately from a new confirmation layout. */
export function mineFormParser(
  text: string,
  opts?: { provider?: TripProvider; fingerprint?: string },
): TripFormParser | null {
  const fingerprint = opts?.fingerprint ?? fingerprintTripForm(text);
  const labels = collectFormLabelKeys(text);
  const pairs: Array<{ label: string; value: string }> = [];
  for (const m of text.matchAll(/^[\t ]*([^:\n]{2,40})[:：]\s*(.+)$/gm)) {
    pairs.push({ label: m[1].trim(), value: m[2].trim() });
  }
  if (pairs.length === 0) return null;

  const votes: Record<TripSegmentType, number> = { flight: 0, hotel: 0, car: 0 };
  const rules: TripFormFieldRule[] = [];
  const seen = new Set<string>();
  for (const { label, value } of pairs) {
    const mapped = matchLabelField(label);
    if (!mapped || !value) continue;
    votes[mapped.type] += 1;
    if (seen.has(mapped.field)) continue;
    seen.add(mapped.field);
    rules.push({
      field: mapped.field,
      pattern: `^\\s*${escapeRe(label)}\\s*[:：]\\s*(.+)$`,
      flags: "im",
    });
  }
  if (rules.length === 0) return null;

  let segmentType: TripSegmentType = guessSegmentType(labels, text);
  const top = (Object.entries(votes) as Array<[TripSegmentType, number]>).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0) segmentType = top[0];

  return {
    form_id: formIdFromFingerprint(fingerprint),
    fingerprint,
    labels,
    segment_type: segmentType,
    provider: opts?.provider ?? "learned_form",
    rules,
    origin: "mined",
  };
}

function ruleFromSourceValue(source: string, field: string, value: string): TripFormFieldRule | null {
  const needle = value.trim();
  if (needle.length < 2) return null;
  const idx = source.indexOf(needle);
  if (idx < 0) return null;
  const before = source.slice(Math.max(0, idx - 60), idx);
  const linePrefix = (before.split(/\n/).pop() ?? before).trim();
  if (linePrefix.length < 2) return null;
  const label = linePrefix.slice(-40);
  return {
    field,
    pattern: `${escapeRe(label)}\\s*(.+)`,
    flags: "i",
  };
}

function payloadRecord(p: TripSegmentPayload): Record<string, unknown> {
  return p as unknown as Record<string, unknown>;
}

/** Update (or create) a form parser from a customer correction. */
export function learnFormParserFromCorrection(opts: {
  sourceText: string;
  before: TripParsedSegment;
  after: TripParsedSegment;
  existing?: TripFormParser | null;
}): TripFormParser {
  const fingerprint = opts.before.source_fingerprint || fingerprintTripForm(opts.sourceText);
  const base: TripFormParser = opts.existing
    ? { ...opts.existing, rules: [...opts.existing.rules] }
    : {
        form_id: opts.before.form_id || formIdFromFingerprint(fingerprint),
        fingerprint,
        labels: collectFormLabelKeys(opts.sourceText),
        segment_type: opts.after.type,
        provider: opts.after.provider === "unknown" ? "learned_form" : opts.after.provider,
        rules: [],
        origin: "correction",
      };

  const prev = payloadRecord(opts.before.payload);
  const next = payloadRecord(opts.after.payload);
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const field of keys) {
    if (field === "type" || field === "travelers") continue;
    const a = prev[field];
    const b = next[field];
    if (b == null || b === "") continue;
    if (String(a ?? "") === String(b)) continue;
    const rule = ruleFromSourceValue(opts.sourceText, field, String(b));
    if (!rule) continue;
    const idx = base.rules.findIndex((r) => r.field === field);
    if (idx >= 0) base.rules[idx] = rule;
    else base.rules.push(rule);
  }
  base.origin = "correction";
  return upsertFormParser(base);
}

export function stampSegments(
  segments: TripParsedSegment[],
  fingerprint: string,
  formId: string | null,
): TripParsedSegment[] {
  return segments.map((s) => ({
    ...s,
    source_fingerprint: s.source_fingerprint ?? fingerprint,
    form_id: s.form_id ?? formId,
  }));
}
