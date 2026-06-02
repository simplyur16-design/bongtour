'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import Header from '@/app/components/Header'
import TrainingDepartureYearCalendar from '@/components/training/TrainingDepartureYearCalendar'
import TrainingInquiryForm from '@/components/inquiry/TrainingInquiryForm'
import TrainingPrepSections from '@/components/training/TrainingPrepSections'
import TrainingHeroGallery from '@/components/training/TrainingHeroGallery'
import TrainingScheduleSections from '@/components/training/TrainingScheduleSections'
import TrainingWindsorTabs, { type TrainingWindsorTabId } from '@/components/training/TrainingWindsorTabs'
import {
  mergeTrainingHeroWithLegacy,
  parseTrainingProgramMetaJson,
} from '@/lib/overseas-training-meta-json'
import type { TrainingProgramPublicRow } from '@/lib/overseas-training-program-query'
import { resolveTrainingPrepForDisplay } from '@/lib/overseas-training-europe-prep-default'
import {
  defaultTrainingDepartureCalendarRange,
  formatTrainingCalendarDayLabel,
  pickDefaultTrainingDepartureYmd,
} from '@/lib/overseas-training-departure-calendar'
import {
  parseTrainingScheduleFromProduct,
  scheduleDaysToTableRows,
  scheduleTextToTableRows,
} from '@/lib/overseas-training-schedule-ssot'
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

export default function TrainingProgramDetailView({ program }: Props) {
  const [tab, setTab] = useState<TrainingWindsorTabId>('description')
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

  const scheduleStorage = useMemo(
    () => parseTrainingScheduleFromProduct(program.schedule),
    [program.schedule]
  )
  const scheduleTableRows = useMemo(() => {
    if (scheduleStorage.mode === 'raw') {
      return scheduleTextToTableRows(scheduleStorage.text)
    }
    return scheduleDaysToTableRows(scheduleStorage.days)
  }, [scheduleStorage])

  const prepSections = useMemo(
    () => resolveTrainingPrepForDisplay(program.prepChecklistJson),
    [program.prepChecklistJson]
  )
  const metaJson = useMemo(
    () => parseTrainingProgramMetaJson(program.summary),
    [program.summary]
  )
  const heroSlides = useMemo(
    () =>
      mergeTrainingHeroWithLegacy(metaJson, {
        bgImageUrl: program.bgImageUrl,
        bgImageIsGenerated: program.bgImageIsGenerated,
        bgImageSource: program.bgImageSource,
        bgImagePhotographer: program.bgImagePhotographer,
      }),
    [metaJson, program]
  )
  const airline = metaJson.airline?.trim() || null
  const description = program.trainingDescription?.trim() || '상품 설명을 준비 중입니다.'

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className="pb-24">
        <section className="border-b border-bt-border bg-white">
          <div className="relative mx-auto max-w-6xl">
            <TrainingHeroGallery slides={heroSlides} title={program.title} />
          </div>
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {category ? (
              <p className="text-sm font-semibold text-[#534AB7]">{TRAINING_CATEGORY_LABELS[category]}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-semibold leading-snug text-[#1F1B2D] sm:text-4xl">{program.title}</h1>
            {meta ? <p className="mt-3 text-lg font-medium text-[#1F1B2D]/90">{meta}</p> : null}
            {airline ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#DAD4EE] bg-[#EFEDF8] px-3 py-1.5 text-sm font-semibold text-[#534AB7]">
                <span className="text-[#85510B]">✈</span> {airline}
              </p>
            ) : null}
            {audience ? (
              <p className="mt-1 text-sm text-slate-600">{TRAINING_AUDIENCE_LABELS[audience]} 대상</p>
            ) : null}
            <p className="mt-4 inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
              이런 프로그램이 있습니다 · 단체 연수 상담 후 견적 안내
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <TrainingWindsorTabs active={tab} onChange={setTab}>
            {tab === 'description' ? (
              <div className="whitespace-pre-wrap text-[17px] leading-relaxed text-black">{description}</div>
            ) : null}

            {tab === 'schedule' ? (
              <div className="space-y-6">
                {program.fixedDepartureWeekday != null && scheduleStorage.mode === 'days' ? (
                  <>
                    <TrainingDepartureYearCalendar
                      fixedDepartureWeekday={program.fixedDepartureWeekday}
                      selectedYmd={selectedDepartureYmd}
                      onSelectYmd={setSelectedDepartureYmd}
                      range={calendarRange}
                    />
                    {selectedDepartureYmd ? (
                      <p className="rounded-lg border border-[#DAD4EE] bg-[#EFEDF8] px-4 py-3 text-center text-sm font-semibold text-black">
                        아래 일정은 {formatTrainingCalendarDayLabel(selectedDepartureYmd)} 출발 기준 예시입니다.
                      </p>
                    ) : null}
                  </>
                ) : null}
                <TrainingScheduleSections rows={scheduleTableRows} />
              </div>
            ) : null}

            {tab === 'prep' ? (
              <TrainingPrepSections sections={prepSections} />
            ) : null}
          </TrainingWindsorTabs>
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
                  snapshotOriginCode: null,
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
