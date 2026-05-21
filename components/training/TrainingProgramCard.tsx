import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import {
  TRAINING_CATEGORY_LABELS,
  parseTrainingCategory,
  type TrainingCategory,
} from '@/lib/overseas-training-taxonomy'
import type { TrainingProgramPublicRow } from '@/lib/overseas-training-program-query'
import { trainingProgramPublicPath } from '@/lib/overseas-training-program-query'
import { formatTrainingProgramMetaLine } from '@/lib/overseas-training-weekday'
import WishlistToggleButton from '@/components/mypage/WishlistToggleButton'

type Props = {
  program: TrainingProgramPublicRow
}

export default function TrainingProgramCard({ program }: Props) {
  const href = trainingProgramPublicPath(program)
  const meta = formatTrainingProgramMetaLine(program.durationDays, program.fixedDepartureWeekday)
  const category = parseTrainingCategory(program.trainingCategory)
  const categoryLabel = category ? TRAINING_CATEGORY_LABELS[category as TrainingCategory] : null
  const dest =
    program.primaryDestination?.trim() ||
    program.destinationRaw?.trim() ||
    program.destination?.trim() ||
    null

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-bt-border bg-white shadow-sm transition hover:border-slate-300">
      <Link href={href} className="relative block aspect-[16/10] bg-slate-100">
        <div className="absolute right-2 top-2 z-10">
          <WishlistToggleButton
            kind="training"
            id={program.id}
            title={program.title}
            slug={program.slug}
            destination={dest}
          />
        </div>
        {program.bgImageUrl ? (
          <SafeImage
            src={program.bgImageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">이미지 준비 중</div>
        )}
        {program.bgImageIsGenerated ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white">
            AI 참고 이미지
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {categoryLabel ? (
          <p className="text-[11px] font-semibold text-emerald-800">{categoryLabel}</p>
        ) : null}
        <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-slate-900">
          <Link href={href} className="hover:text-emerald-800">
            {program.title}
          </Link>
        </h3>
        {meta ? <p className="mt-2 text-sm font-medium text-slate-700">{meta}</p> : null}
        {dest ? <p className="mt-1 text-sm text-slate-500">{dest}</p> : null}
        <p className="mt-3 text-xs text-slate-500">이런 프로그램이 있습니다 · 가격은 상담 후 안내</p>
        <div className="mt-4">
          <Link
            href={href}
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            프로그램 보기
          </Link>
        </div>
      </div>
    </article>
  )
}
