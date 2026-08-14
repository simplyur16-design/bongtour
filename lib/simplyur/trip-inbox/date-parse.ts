/** Shared date / airport helpers for Trip Inbox parsers */
const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

/** "Sun, Aug 09, 2026" + "09:50 AM" → ISO local without offset */
export function parseUnitedDateTime(datePart: string, timePart: string): string | null {
  const dm = datePart.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  const tm = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!dm || !tm) return null;
  const mon = MONTHS[dm[1].toLowerCase()];
  if (!mon) return null;
  let hh = parseInt(tm[1], 10);
  const mm = tm[2];
  const ap = tm[3].toUpperCase();
  if (ap === "PM" && hh < 12) hh += 12;
  if (ap === "AM" && hh === 12) hh = 0;
  const day = dm[2].padStart(2, "0");
  return `${dm[3]}-${mon}-${day}T${String(hh).padStart(2, "0")}:${mm}:00`;
}

/** "2026년 9월 7일 08:25" or "2026년  9월  7일  08:25" */
export function parseKoDateTime(raw: string): string | null {
  const m = raw.replace(/\s+/g, " ").match(
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(\d{1,2}):(\d{2})/,
  );
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T${m[4].padStart(2, "0")}:${m[5]}:00`;
}

/** "2026년 11월 02일 (월) 14:00 - 23:00" → date + window start */
export function parseKoDateOptionalTime(raw: string): { date: string; time?: string } | null {
  const m = raw.replace(/\s+/g, " ").match(
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*\([^)]*\))?(?:\s*(\d{1,2}):(\d{2}))?/,
  );
  if (!m) return null;
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if (m[4] && m[5]) return { date, time: `${m[4].padStart(2, "0")}:${m[5]}` };
  return { date };
}

/** "04AUG26(화)10:35" or "04AUG 10:15" / "29JUL2026(수) 07:35" */
export function parseCompactAirlineDateTime(raw: string): string | null {
  const t = raw.replace(/\s+/g, "");
  let m = t.match(/(\d{2})([A-Z]{3})(\d{2,4})(?:\([^)]*\))?(\d{2}):?(\d{2})/i);
  if (!m) {
    m = raw.replace(/\s+/g, " ").match(/(\d{2})([A-Z]{3})(?:\s*)(\d{2,4})?(?:\([^)]*\))?\s*(\d{1,2}):(\d{2})/i);
  }
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  let year = m[3] ?? "";
  if (year.length === 2) year = `20${year}`;
  if (year.length !== 4) {
    // "04AUG 10:15" without year — leave null (caller may inject)
    return null;
  }
  return `${year}-${mon}-${m[1]}T${m[4].padStart(2, "0")}:${m[5]}:00`;
}

/** "2026-07-29 21:00:00" */
export function parseIsoLikeLocal(raw: string): string | null {
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
}

export function extractIata(token: string): string | null {
  const m = token.match(/\(([A-Z]{3})\)/);
  if (m) return m[1];
  const bare = token.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(bare)) return bare;
  return null;
}

export function newTempId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
