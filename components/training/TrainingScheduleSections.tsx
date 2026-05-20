import type { ScheduleTableRow } from '@/lib/overseas-training-schedule-ssot'
import {
  classifyTrainingScheduleLine,
  trainingScheduleLineClassName,
} from '@/lib/overseas-training-schedule-line-style'

type Props = {
  rows: ScheduleTableRow[]
}

function ScheduleLines({ body }: { body: string }) {
  const lines = body.split('\n')
  return (
    <div className="space-y-1.5 text-[15px] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd()
        if (!trimmed.trim()) return <div key={`sp-${i}`} className="h-2" />
        const kind = classifyTrainingScheduleLine(trimmed)
        return (
          <p key={`${i}-${trimmed.slice(0, 24)}`} className={`whitespace-pre-wrap ${trainingScheduleLineClassName(kind)}`}>
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

export default function TrainingScheduleSections({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-[#534AB7]">상세 일정을 준비 중입니다.</p>
  }

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <section
          key={`${row.dayLabel}-${i}`}
          className="overflow-hidden rounded-2xl border border-[#DAD4EE] bg-white shadow-sm"
        >
          <div className="border-b border-[#DAD4EE] bg-[#EFEDF8] px-4 py-3">
            <h3 className="text-base font-bold text-[#1F1B2D] sm:text-lg">{row.dayLabel}</h3>
          </div>
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <ScheduleLines body={row.body} />
          </div>
        </section>
      ))}
    </div>
  )
}
