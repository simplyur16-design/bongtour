'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Header from '@/app/components/Header'
import TrainingProgramCard from '@/components/training/TrainingProgramCard'
import type { TrainingProgramPublicRow } from '@/lib/overseas-training-program-query'
import {
  TRAINING_AUDIENCE_LABELS,
  TRAINING_CATEGORY_LABELS,
  TRAINING_CATEGORY_VALUES,
  trainingAudienceMatchesFilter,
  parseTrainingCategory,
  type TrainingAudience,
  type TrainingCategory,
} from '@/lib/overseas-training-taxonomy'

type Props = {
  programs: TrainingProgramPublicRow[]
  initialAudience?: string | null
  initialCategory?: string | null
}

export default function TrainingProgramsCatalog({
  programs,
  initialAudience,
  initialCategory,
}: Props) {
  const [audience, setAudience] = useState<TrainingAudience | 'all'>(
    initialAudience === 'public' || initialAudience === 'corporate'
      ? initialAudience
      : 'all'
  )
  const [category, setCategory] = useState<TrainingCategory | 'all'>(
    parseTrainingCategory(initialCategory ?? null) ?? 'all'
  )

  const filtered = useMemo(() => {
    return programs.filter((p) => {
      if (category !== 'all') {
        const c = parseTrainingCategory(p.trainingCategory)
        if (c !== category) return false
      }
      if (audience !== 'all' && !trainingAudienceMatchesFilter(p.trainingAudience, audience)) {
        return false
      }
      return true
    })
  }, [programs, audience, category])

  const buildHref = (a: TrainingAudience | 'all', c: TrainingCategory | 'all') => {
    const params = new URLSearchParams()
    if (a !== 'all') params.set('audience', a)
    if (c !== 'all') params.set('category', c)
    const q = params.toString()
    return q ? `/business/programs?${q}` : '/business/programs'
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Overseas Training Programs</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">국외연수 프로그램</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-slate-700">
          공무·기업 목적의 국외출장연수 프로그램을 소개합니다. 가장 일반적인 프로그램들이며 연수프로그램은 목적에 맞도록
          매번 새롭게 만들어집니다.
        </p>

        <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {(['all', 'public', 'corporate'] as const).map((a) => (
            <Link
              key={a}
              href={buildHref(a, category)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                audience === a
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {a === 'all' ? '전체' : TRAINING_AUDIENCE_LABELS[a]}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={buildHref(audience, 'all')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              category === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700'
            }`}
          >
            전체 분야
          </Link>
          {TRAINING_CATEGORY_VALUES.map((c) => (
            <Link
              key={c}
              href={buildHref(audience, c)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                category === c ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'
              }`}
            >
              {TRAINING_CATEGORY_LABELS[c]}
            </Link>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 text-center text-slate-600">조건에 맞는 프로그램이 없습니다.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <TrainingProgramCard key={p.id} program={p} />
            ))}
          </div>
        )}

        <p className="mt-10 text-center">
          <Link href="/business" className="text-sm font-semibold text-bt-link hover:underline">
            공공·기업 안내로 돌아가기
          </Link>
        </p>
      </main>
    </div>
  )
}
