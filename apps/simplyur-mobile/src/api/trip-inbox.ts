import { getApiBaseUrl } from '@/src/constants/simplyur';
import { getSimplyurAccessToken } from '@/src/lib/session';

export type TripParseStatus = 'confirmed' | 'needs_review' | 'failed';
export type TripSegmentType = 'flight' | 'hotel' | 'car';

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
};

export type TripParseResult = {
  provider: string;
  segments: TripParsedSegment[];
  warnings: string[];
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSimplyurAccessToken();
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: mobile parse client — manifest */
export async function parseTripInboxText(
  text: string,
): Promise<
  | { ok: true; result: TripParseResult }
  | { ok: false; unauthorized: boolean; error?: string }
> {
  const url = `${getApiBaseUrl()}/api/simplyur/trips/parse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ text }),
  });
  const json = (await res.json()) as TripParseResult & { error?: string };
  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok) return { ok: false, unauthorized: false, error: json.error };
  return { ok: true, result: json };
}

export async function correctTripSegment(
  segment: TripParsedSegment,
  payload: Record<string, string | null>,
): Promise<
  | { ok: true; segment: TripParsedSegment }
  | { ok: false; unauthorized: boolean; error?: string }
> {
  const url = `${getApiBaseUrl()}/api/simplyur/trips/correct`;
  const res = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ segment, patch: { payload } }),
  });
  const json = (await res.json()) as { segment?: TripParsedSegment; error?: string };
  if (res.status === 401) return { ok: false, unauthorized: true };
  if (!res.ok || !json.segment) return { ok: false, unauthorized: false, error: json.error };
  return { ok: true, segment: json.segment };
}
