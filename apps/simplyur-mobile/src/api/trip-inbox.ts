import { getApiBaseUrl } from '@/src/constants/simplyur';
import { getSimplyurAccessToken } from '@/src/lib/session';

export type TripParseStatus = 'confirmed' | 'needs_review' | 'failed';
export type TripSegmentType = 'flight' | 'hotel' | 'car' | 'experience';

export type TripParsedSegment = {
  temp_id: string;
  type: TripSegmentType;
  provider: string;
  status: TripParseStatus;
  confidence: number;
  sort_at: string | null;
  merge_key: string | null;
  payload: Record<string, unknown> & { type: TripSegmentType };
  issues: string[];
  source_fingerprint?: string | null;
  form_id?: string | null;
};

export type TripFormParser = {
  form_id: string;
  fingerprint: string;
  labels: string[];
  segment_type: TripSegmentType;
  provider: string;
  rules: Array<{ field: string; pattern: string; flags?: string }>;
  origin: 'mined' | 'correction';
};

export type TripParseResult = {
  provider: string;
  segments: TripParsedSegment[];
  warnings: string[];
  source_fingerprint?: string;
  form_parser?: TripFormParser | null;
  source_text?: string;
};

async function authHeaders(json = true): Promise<Record<string, string>> {
  const token = await getSimplyurAccessToken();
  const h: Record<string, string> = { Accept: 'application/json' };
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: mobile parse client — manifest */
/** REGRESSION-FREEZE[simplyur-trip-inbox-forms]: pdfBase64 + formParsers client — manifest */
export async function parseTripInboxText(
  text: string,
  opts?: { pdfBase64?: string; formParsers?: TripFormParser[] },
): Promise<
  | { ok: true; result: TripParseResult }
  | { ok: false; unauthorized: boolean; error?: string }
> {
  const url = `${getApiBaseUrl()}/api/simplyur/trips/parse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      text,
      pdfBase64: opts?.pdfBase64 || undefined,
      formParsers: opts?.formParsers,
    }),
  });
  const json = (await res.json()) as TripParseResult & { error?: string };
  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok) return { ok: false, unauthorized: false, error: json.error };
  return { ok: true, result: json };
}

export async function correctTripSegment(
  segment: TripParsedSegment,
  payload: Record<string, string | null>,
  opts?: { sourceText?: string; formParser?: TripFormParser | null },
): Promise<
  | { ok: true; segment: TripParsedSegment; form_parser: TripFormParser | null }
  | { ok: false; unauthorized: boolean; error?: string }
> {
  const url = `${getApiBaseUrl()}/api/simplyur/trips/correct`;
  const res = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      segment,
      patch: { payload },
      source_text: opts?.sourceText || undefined,
      form_parser: opts?.formParser || undefined,
    }),
  });
  const json = (await res.json()) as {
    segment?: TripParsedSegment;
    form_parser?: TripFormParser | null;
    error?: string;
  };
  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok || !json.segment) return { ok: false, unauthorized: false, error: json.error };
  return { ok: true, segment: json.segment, form_parser: json.form_parser ?? null };
}
