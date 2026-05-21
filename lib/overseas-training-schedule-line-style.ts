export type TrainingScheduleLineKind = 'official_visit' | 'bullet' | 'meeting' | 'plain'

export function classifyTrainingScheduleLine(line: string): TrainingScheduleLineKind {
  const t = line.trim()
  if (!t) return 'plain'
  if (/공식\s*방문|■\s*공식방문/i.test(t)) return 'official_visit'
  if (/^■/.test(t)) return 'bullet'
  if (/미팅|가이드\s*\/\s*인솔|인솔자|미팅정보/i.test(t)) return 'meeting'
  return 'plain'
}

const LINE_CLASS: Record<TrainingScheduleLineKind, string> = {
  official_visit: 'font-semibold text-red-800',
  bullet: 'font-semibold text-blue-800',
  meeting: 'font-semibold text-teal-900',
  plain: 'text-slate-800',
}

export function trainingScheduleLineClassName(kind: TrainingScheduleLineKind): string {
  return LINE_CLASS[kind]
}
