import Link from 'next/link'
import type { TrainingProgramPublicRow } from '@/lib/overseas-training-program-query'
import TrainingProgramsPreviewCarousel from '@/components/training/TrainingProgramsPreviewCarousel'

type Props = {
  programs: TrainingProgramPublicRow[]
}

/**
 * 공공·기업 허브 「연수프로그램」 슬롯 (데이터는 page에서 connection() 후 로드).
 * REGRESSION-FREEZE[business-training-programs-empty-poison]: preview is presentational — manifest
 */
export default function TrainingProgramsPreview({ programs }: Props) {
  return (
    <section className="border-b border-bt-border bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[34px]">
              연수프로그램
            </h2>
            <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-slate-700">
              공무·기업 목적의 국외출장연수 프로그램을 소개합니다. 가장 일반적인 프로그램들이며 연수프로그램은 목적에 맞도록
              매번 새롭게 만들어집니다.
            </p>
          </div>
          <Link
            href="/business/programs"
            className="text-sm font-semibold text-bt-link underline-offset-2 hover:underline"
          >
            전체 프로그램 보기
          </Link>
        </div>

        {programs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-[17px] font-medium text-slate-800">연수 프로그램을 준비 중입니다.</p>
            <p className="mt-2 text-sm text-slate-600">
              목적에 맞는 연수 방향은 아래 「국외연수 문의하기」로 접수해 주세요.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <TrainingProgramsPreviewCarousel programs={programs} />
          </div>
        )}
      </div>
    </section>
  )
}
