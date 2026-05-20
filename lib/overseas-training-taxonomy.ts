/** 국외연수 프로그램 — 공개·관리자 공통 분류 SSOT */

export const TRAINING_AUDIENCE_VALUES = ['public', 'corporate', 'both'] as const
export type TrainingAudience = (typeof TRAINING_AUDIENCE_VALUES)[number]

export const TRAINING_CATEGORY_VALUES = [
  'education',
  'policy',
  'agri',
  'industry_esg',
  'energy_urban',
  'safety',
  'culture',
  'benchmark_other',
] as const
export type TrainingCategory = (typeof TRAINING_CATEGORY_VALUES)[number]

export const TRAINING_CATEGORY_LABELS: Record<TrainingCategory, string> = {
  education: '교육연수(학교, 유치원, 보육원)',
  policy: '복지·행정·경제·노사 정책연수',
  agri: '농·축·수산업 연수(스마트팜, 협동조합)',
  industry_esg: '제조·서비스·정보통신: ESG, 4차산업, 사회적기업',
  energy_urban: '에너지·친환경·건축·도시재생',
  safety: '재난·안전·소방·방재',
  culture: '문화·관광·패션·디자인·예술',
  benchmark_other: '그 외 벤치마킹 일정',
}

export const TRAINING_AUDIENCE_LABELS: Record<TrainingAudience, string> = {
  public: '공무연수',
  corporate: '기업연수',
  both: '공무·기업',
}

export function parseTrainingCategory(raw: string | null | undefined): TrainingCategory | null {
  if (!raw) return null
  const t = raw.trim()
  return TRAINING_CATEGORY_VALUES.includes(t as TrainingCategory) ? (t as TrainingCategory) : null
}

export function parseTrainingAudience(raw: string | null | undefined): TrainingAudience | null {
  if (!raw) return null
  const t = raw.trim()
  return TRAINING_AUDIENCE_VALUES.includes(t as TrainingAudience) ? (t as TrainingAudience) : null
}

/** 목록 필터: audience 탭이 해당 프로그램을 포함하는지 */
export function trainingAudienceMatchesFilter(
  programAudience: string | null | undefined,
  filter: TrainingAudience | null
): boolean {
  if (!filter) return true
  const a = parseTrainingAudience(programAudience)
  if (!a) return filter === 'public'
  if (a === 'both') return true
  return a === filter
}
