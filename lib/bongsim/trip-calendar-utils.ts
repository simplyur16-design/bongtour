/** YYYY-MM-DD */
export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmdLocal(ymd: string): Date | null {
  const p = ymd.split("-").map((n) => Number(n));
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
  const d = new Date(p[0]!, p[1]! - 1, p[2]!);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function compareYmd(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 0=Sun … 6=Sat for first day of month */
export function weekdayOfFirstOfMonth(year: number, monthIndex: number): number {
  return startOfMonth(year, monthIndex).getDay();
}

export function addMonths(year: number, monthIndex: number, delta: number): { y: number; m: number } {
  const d = new Date(year, monthIndex + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}
