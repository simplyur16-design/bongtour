import Link from 'next/link'
import { listPublishedTrainingPrograms } from '@/lib/overseas-training-program-query'
import TrainingProgramCard from '@/components/training/TrainingProgramCard'

export default async function TrainingProgramsPreview() {
  const programs = await listPublishedTrainingPrograms({ limit: 8 })

  return (
    <section className="border-b border-bt-border bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[34px]">
              이런 연수 프로그램이 있습니다
            </h2>
            <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-slate-700">
              공무·기업 목적의 국외연수 프로그램을 소개합니다. 가격은 공개하지 않으며, 맞춤 견적은 문의 후 안내드립니다.
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
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {programs.map((p) => (
              <TrainingProgramCard key={p.id} program={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
