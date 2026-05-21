import type { ScheduleTableRow } from '@/lib/overseas-training-schedule-ssot'
import {
  parseScheduleDayLabel,
  parseWindsorScheduleDayBody,
} from '@/lib/overseas-training-schedule-ssot'
import {
  classifyTrainingScheduleLine,
  trainingScheduleLineClassName,
} from '@/lib/overseas-training-schedule-line-style'
import {
  TRAINING_PUBLIC_BG,
  TRAINING_PUBLIC_BG_HOVER,
  TRAINING_PUBLIC_BORDER,
  TRAINING_PUBLIC_TEXT,
} from '@/components/training/training-public-theme'

type Props = {
  rows: ScheduleTableRow[]
}

function ScheduleLines({ body }: { body: string }) {
  if (!body.trim()) return null
  const lines = body.split('\n')
  return (
    <div className={`space-y-1.5 text-[15px] leading-relaxed ${TRAINING_PUBLIC_TEXT}`}>
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
    <div className={`overflow-hidden rounded-lg border ${TRAINING_PUBLIC_BORDER} bg-white`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG} px-4 py-3`}
      >
        <p className={`text-lg font-bold ${TRAINING_PUBLIC_TEXT}`}>{dayHeading}</p>
        {dateHeading ? <p className={`text-base font-bold ${TRAINING_PUBLIC_TEXT}`}>{dateHeading}</p> : null}
      </div>

      {layout.cityBlocks.map((block, bi) => (
        <div
          key={`${dayHeading}-block-${bi}-${block.cities[0] ?? 'row'}`}
          className={`flex flex-col items-stretch sm:flex-row sm:items-start ${
            bi < layout.cityBlocks.length - 1 ? `border-b ${TRAINING_PUBLIC_BORDER}` : ''
          }`}
        >
          <div
            className={`flex w-full shrink-0 items-start border-b ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG_HOVER} px-4 py-4 sm:w-[28%] sm:border-b-0 sm:border-r sm:py-5`}
          >
            {block.cities[0] ? (
              <p className={`text-base font-bold leading-snug text-bt-text-navy`}>{block.cities[0]}</p>
            ) : (
              <span className={`text-sm font-medium ${TRAINING_PUBLIC_TEXT} opacity-60`}>—</span>
            )}
          </div>
          <div className={`min-w-0 flex-1 px-4 py-4 sm:py-5 ${TRAINING_PUBLIC_BG} ${TRAINING_PUBLIC_TEXT}`}>
            <ScheduleLines body={block.schedule} />
          </div>
        </div>
      ))}

      {layout.footerHotel ? (
        <div
          className={`flex flex-col gap-1 border-t ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG} px-4 py-3 sm:flex-row sm:items-start sm:gap-3`}
        >
          <span className={`shrink-0 text-sm font-bold ${TRAINING_PUBLIC_TEXT}`}>숙박</span>
          <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${TRAINING_PUBLIC_TEXT}`}>{layout.footerHotel}</p>
        </div>
      ) : null}
      {layout.footerMeals ? (
        <div
          className={`flex flex-col gap-1 border-t ${TRAINING_PUBLIC_BORDER} ${TRAINING_PUBLIC_BG_HOVER} px-4 py-3 sm:flex-row sm:items-start sm:gap-3`}
        >
          <span className={`shrink-0 text-sm font-bold ${TRAINING_PUBLIC_TEXT}`}>식사</span>
          <p className={`whitespace-pre-wrap text-[15px] leading-relaxed ${TRAINING_PUBLIC_TEXT}`}>{layout.footerMeals}</p>
        </div>
      ) : null}
    </div>
  )
}

export default function TrainingScheduleSections({ rows }: Props) {
  if (rows.length === 0) {
    return <p className={TRAINING_PUBLIC_TEXT}>상세 일정을 준비 중입니다.</p>
  }

  return (
    <div className="space-y-6">
      {rows.map((row, i) => (
        <WindsorDayTable key={`${row.dayLabel}-${i}`} dayLabel={row.dayLabel} body={row.body} />
      ))}
    </div>
  )
}
