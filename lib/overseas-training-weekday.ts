const WEEKDAY_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/** 공개 메타 — 「화요일 출발」 (매주/매월/매년 문구 없음) */
export function formatTrainingDepartureWeekdayLabel(weekday: number | null | undefined): string | null {
  if (weekday == null || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null
  return `${WEEKDAY_KO[weekday]} 출발`
}

export function formatTrainingDurationLabel(days: number | null | undefined): string | null {
  if (days == null || !Number.isInteger(days) || days < 1) return null
  return `${days}일 프로그램`
}

/** 카드·히어로 한 줄: `9일 · 화요일 출발` */
export function formatTrainingProgramMetaLine(
  durationDays: number | null | undefined,
  fixedDepartureWeekday: number | null | undefined
): string {
  const parts: string[] = []
  const dur = formatTrainingDurationLabel(durationDays)
  const dep = formatTrainingDepartureWeekdayLabel(fixedDepartureWeekday)
  if (dur) parts.push(dur)
  if (dep) parts.push(dep)
  return parts.join(' · ')
}
