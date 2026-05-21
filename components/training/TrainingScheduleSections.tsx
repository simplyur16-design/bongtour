import type { ScheduleTableRow } from '@/lib/overseas-training-schedule-ssot'
import {
  parseScheduleDayLabel,
  parseWindsorScheduleDayBody,
} from '@/lib/overseas-training-schedule-ssot'
import {
  classifyTrainingScheduleLine,
  trainingScheduleLineClassName,
} from '@/lib/overseas-training-schedule-line-style'

type Props = {
  rows: ScheduleTableRow[]
}

function ScheduleLines({ body }: { body: string }) {
  if (!body.trim()) return null
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

function WindsorDayTable({ dayLabel, body }: { dayLabel: string; body: string }) {
  const { dayHeading, dateHeading } = parseScheduleDayLabel(dayLabel)
  const layout = parseWindsorScheduleDayBody(body)

  return (
    <div className="overflow-hidden rounded-lg border border-[#d4c4a8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d4c4a8] bg-[#f3e4b8] px-4 py-3">
        <p className="text-lg font-bold text-slate-900">{dayHeading}</p>
        {dateHeading ? <p className="text-base font-bold text-slate-900">{dateHeading}</p> : null}
      </div>

      {layout.cityBlocks.map((block, bi) => (
        <div
          key={`${dayHeading}-block-${bi}-${block.cities[0] ?? 'row'}`}
          className={`flex flex-col items-stretch sm:flex-row sm:items-start ${
            bi < layout.cityBlocks.length - 1 ? 'border-b border-[#e8dcc8]' : ''
          }`}
        >
          <div className="flex w-full shrink-0 items-start border-b border-[#e8dcc8] bg-[#faf8f3] px-4 py-4 sm:w-[28%] sm:border-b-0 sm:border-r sm:py-5">
            {block.cities[0] ? (
              <p className="text-base font-bold leading-snug text-slate-900">{block.cities[0]}</p>
            ) : (
              <span className="text-sm font-medium text-slate-500">—</span>
            )}
          </div>
          <div className="min-w-0 flex-1 px-4 py-4 sm:py-5 text-slate-800">
            <ScheduleLines body={block.schedule} />
          </div>
        </div>
      ))}

      {layout.footerHotel ? (
        <div className="flex flex-col gap-1 border-t border-[#e8dcc8] bg-[#faf8f3] px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
          <span className="shrink-0 text-sm font-bold text-slate-900">숙박</span>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{layout.footerHotel}</p>
        </div>
      ) : null}
      {layout.footerMeals ? (
        <div className="flex flex-col gap-1 border-t border-[#e8dcc8] px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
          <span className="shrink-0 text-sm font-bold text-slate-900">식사</span>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{layout.footerMeals}</p>
        </div>
      ) : null}
    </div>
  )
}

export default function TrainingScheduleSections({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-slate-600">상세 일정을 준비 중입니다.</p>
  }

  return (
    <div className="space-y-6">
      {rows.map((row, i) => (
        <WindsorDayTable key={`${row.dayLabel}-${i}`} dayLabel={row.dayLabel} body={row.body} />
      ))}
    </div>
  )
}
