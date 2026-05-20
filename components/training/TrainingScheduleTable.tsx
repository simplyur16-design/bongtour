import type { ScheduleTableRow } from '@/lib/overseas-training-schedule-ssot'

type Props = {
  rows: ScheduleTableRow[]
}

export default function TrainingScheduleTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-slate-600">상세 일정을 준비 중입니다.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#d4c4a8]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[15px] leading-relaxed text-slate-800">
        <thead>
          <tr className="bg-[#f3e4b8]">
            <th className="w-[28%] border-b border-r border-[#d4c4a8] px-4 py-3 font-bold text-slate-900">
              일차
            </th>
            <th className="border-b border-[#d4c4a8] px-4 py-3 font-bold text-slate-900">일정 내용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.dayLabel}-${i}`}
              className={i % 2 === 0 ? 'bg-white' : 'bg-[#faf8f3]'}
            >
              <td className="align-top border-b border-r border-[#e8dcc8] px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
                {row.dayLabel}
              </td>
              <td className="align-top border-b border-[#e8dcc8] px-4 py-4 whitespace-pre-wrap">
                {row.body}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
