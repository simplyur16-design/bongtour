/**
 * 공개 POST 본문에서 UTM·유입 필드만 안전하게 추출 (서버 전용).
 */

export type ParsedPublicAttribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  landingPath: string | null;
};

function optTrim(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** `/api/bookings`, `/api/inquiries`, bongsim checkout 등 공통 payload 키 (camelCase). */
export function parsePublicAttributionFromBody(body: Record<string, unknown>): ParsedPublicAttribution {
  return {
    utmSource: optTrim(body.utmSource, 500),
    utmMedium: optTrim(body.utmMedium, 500),
    utmCampaign: optTrim(body.utmCampaign, 500),
    utmContent: optTrim(body.utmContent, 500),
    utmTerm: optTrim(body.utmTerm, 500),
    referrer: optTrim(body.referrer, 2000),
    landingPath: optTrim(body.landingPath, 2000),
  };
}
