export type CountryDateRange = { code: string; start: Date; end: Date };

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): number {
  return startOfDay(d).getTime();
}

/** 다른 국가 구간의 내부(시작·종료일 제외)에 해당하는지 */
export function isStrictInteriorOfRange(d: Date, rangeStart: Date, rangeEnd: Date): boolean {
  const D = dayKey(d);
  const a = dayKey(rangeStart);
  const b = dayKey(rangeEnd);
  if (a === b) return false;
  return D > a && D < b;
}

export function isDayBlockedByOtherInteriors(
  d: Date,
  ranges: CountryDateRange[],
  excludeCode: string,
): boolean {
  for (const r of ranges) {
    if (r.code === excludeCode) continue;
    if (isStrictInteriorOfRange(d, r.start, r.end)) return true;
  }
  return false;
}

/** 다른 국가의 시작일 또는 종료일(경계일)인지 — 점 표시용 */
export function isOtherCountryBoundaryDay(
  d: Date,
  ranges: CountryDateRange[],
  excludeCode: string,
): boolean {
  const D = dayKey(d);
  for (const r of ranges) {
    if (r.code === excludeCode) continue;
    const a = dayKey(r.start);
    const b = dayKey(r.end);
    if (D === a || D === b) return true;
  }
  return false;
}

/**
 * 두 inclusive 구간이 허용되는지: 겹침 없음 또는 하루만 겹치며 그날이 한쪽의 종료·다른 쪽의 시작(경계 맞닿음).
 * 예: A 4/28~5/2, B 5/2~5/5 → 5/2 하루만 겹침·허용. A 4/28~5/3, B 5/1~5/5 → 내부일 다중 겹침·불가.
 */
export function rangesTouchCompatible(a1: Date, a2: Date, b1: Date, b2: Date): boolean {
  const t = dayKey;
  const s1 = t(a1);
  const e1 = t(a2);
  const s2 = t(b1);
  const e2 = t(b2);
  if (e1 < s2 || e2 < s1) return true;
  const os = Math.max(s1, s2);
  const oe = Math.min(e1, e2);
  if (os < oe) return false;
  if (os > oe) return true;
  const D = os;
  return (e1 === D && s2 === D) || (e2 === D && s1 === D);
}

export function isRangeAllowedWithOthers(
  start: Date,
  end: Date,
  ranges: CountryDateRange[],
  excludeCode: string,
): boolean {
  for (const r of ranges) {
    if (r.code === excludeCode) continue;
    if (!rangesTouchCompatible(start, end, r.start, r.end)) return false;
  }
  return true;
}
