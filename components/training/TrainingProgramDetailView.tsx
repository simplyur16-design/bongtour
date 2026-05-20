'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import Header from '@/app/components/Header'
import { ScheduleDayItineraryBlocks } from '@/components/itinerary/ScheduleDayItineraryBlocks'
import TrainingDepartureYearCalendar from '@/components/training/TrainingDepartureYearCalendar'
import TrainingInquiryForm from '@/components/inquiry/TrainingInquiryForm'
import type { TrainingProgramPublicRow } from '@/lib/overseas-training-program-query'
import { parsePrepChecklistJson } from '@/lib/overseas-training-program-query'
import {
  defaultTrainingDepartureCalendarRange,
  formatTrainingCalendarDayLabel,
  pickDefaultTrainingDepartureYmd,
  trainingScheduleDayYmd,
} from '@/lib/overseas-training-departure-calendar'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import {
  TRAINING_AUDIENCE_LABELS,
  TRAINING_CATEGORY_LABELS,
  parseTrainingAudience,
  parseTrainingCategory,
} from '@/lib/overseas-training-taxonomy'
import { formatTrainingProgramMetaLine } from '@/lib/overseas-training-weekday'

type Props = {
  program: TrainingProgramPublicRow
}

const TABS = [
  { id: 'description', label: '상품설명' },
  { id: 'schedule', label: '상세일정' },
  { id: 'prep', label: '여행준비·체크' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function TrainingProgramDetailView({ program }: Props) {
  const [tab, setTab] = useState<TabId>('description')
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const calendarRange = useMemo(() => defaultTrainingDepartureCalendarRange(), [])
  const [selectedDepartureYmd, setSelectedDepartureYmd] = useState<string | null>(null)

  useEffect(() => {
    if (program.fixedDepartureWeekday == null) {
      setSelectedDepartureYmd(null)
      return
    }
    setSelectedDepartureYmd(
      pickDefaultTrainingDepartureYmd(program.fixedDepartureWeekday, calendarRange)
    )
  }, [program.fixedDepartureWeekday, calendarRange])

  const meta = formatTrainingProgramMetaLine(program.durationDays, program.fixedDepartureWeekday)
  const category = parseTrainingCategory(program.trainingCategory)
  const audience = parseTrainingAudience(program.trainingAudience)
  const prep = parsePrepChecklistJson(program.prepChecklistJson)
  const scheduleDays = useMemo(
    () => getScheduleFromProduct({ schedule: program.schedule, itineraries: [] }),
    [program.schedule]
  )

  const description =
    program.trainingDescription?.trim() || program.summary?.trim() || '상품 설명을 준비 중입니다.'

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className="pb-24">
        <section className="border-b border-bt-border bg-white">
          <div className="relative mx-auto max-w-6xl">
            <div className="relative aspect-[21/9] max-h-[420px] w-full bg-slate-100 sm:aspect-[2.4/1]">
              {program.bgImageUrl ? (
                <SafeImage src={program.bgImageUrl} alt="" fill sizes="100vw" className="object-cover" priority />
              ) : null}
            </div>
            {program.bgImageIsGenerated ? (
              <p className="px-4 py-1 text-right text-xs text-slate-500 sm:px-6">
                사진은 AI 생성 참고 이미지입니다.
              </p>
            ) : null}
          </div>
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {category ? (
              <p className="text-sm font-semibold text-emerald-800">{TRAINING_CATEGORY_LABELS[category]}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-semibold leading-snug text-slate-900 sm:text-4xl">{program.title}</h1>
            {meta ? <p className="mt-3 text-lg font-medium text-slate-700">{meta}</p> : null}
            {audience ? (
              <p className="mt-1 text-sm text-slate-600">{TRAINING_AUDIENCE_LABELS[audience]} 대상</p>
            ) : null}
            <p className="mt-4 inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
              이런 프로그램이 있습니다 · 단체 연수 상담 후 견적 안내
            </p>
          </div>
        </section>

        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${
                  tab === t.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {tab === 'description' ? (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-[17px] leading-relaxed text-slate-800">
              {description}
            </div>
          ) : null}

          {tab === 'schedule' ? (
            <div className="space-y-8">
              <TrainingDepartureYearCalendar
                fixedDepartureWeekday={program.fixedDepartureWeekday}
                selectedYmd={selectedDepartureYmd}
                onSelectYmd={setSelectedDepartureYmd}
                range={calendarRange}
              />

              {scheduleDays.length === 0 ? (
                <p className="text-slate-600">상세 일정을 준비 중입니다.</p>
              ) : (
                <>
                  {selectedDepartureYmd ? (
                    <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm font-semibold text-amber-950">
                      아래 일정은 {formatTrainingCalendarDayLabel(selectedDepartureYmd)} 출발 기준 예시입니다.
                    </p>
                  ) : null}
                  <div className="space-y-8">
                    {scheduleDays.map((day, idx) => {
                      const dayNum = Math.floor(Number(day.day))
                      const dayYmd =
                        selectedDepartureYmd != null
                          ? trainingScheduleDayYmd(selectedDepartureYmd, dayNum)
                          : null
                      return (
                        <section key={`${day.day}-${idx}`} className="space-y-4 scroll-mt-28">
                          <div className="border-b border-[#DAD4EE] pb-4">
                            <p className="text-xs font-bold tracking-widest text-amber-800 mb-1">
                              DAY {day.day}
                              {dayYmd ? (
                                <span className="ml-2 font-semibold text-slate-700">
                                  · {formatTrainingCalendarDayLabel(dayYmd)}
                                </span>
                              ) : null}
                            </p>
                            {day.title ? (
                              <h3 className="text-xl font-black text-slate-900 sm:text-2xl">{day.title}</h3>
                            ) : null}
                          </div>
                          <ScheduleDayItineraryBlocks
                            day={day}
                            isLastScheduleRow={idx === scheduleDays.length - 1}
                          />
                        </section>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {tab === 'prep' ? (
            <div className="space-y-6">
              {prep.length === 0 ? (
                <p className="text-slate-600">여행 준비·체크 사항을 준비 중입니다.</p>
              ) : (
                prep.map((section) => (
                  <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] text-slate-700">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          ) : null}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/business/programs" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            목록으로
          </Link>
          <button
            type="button"
            onClick={() => setInquiryOpen(true)}
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            이 프로그램 문의하기
          </button>
        </div>
      </div>

      {inquiryOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-3 sm:p-6">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">이 프로그램 문의</h2>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{program.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setInquiryOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[calc(92vh-72px)] overflow-y-auto">
              <TrainingInquiryForm
                initialQuery={{
                  productId: program.id,
                  monthlyCurationItemId: null,
                  snapshotProductTitle: program.title,
                  snapshotCardLabel: program.title,
                  targetYearMonth: null,
                  trainingServiceScope: null,
                }}
                overlayMeta={{
                  title: '프로그램 문의',
                  description: '선택하신 연수 프로그램을 기준으로 상담을 진행합니다.',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
