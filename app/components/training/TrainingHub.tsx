'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/app/components/Header'
import TrainingInquiryForm, { TRAINING_SERVICE_OPTIONS } from '@/components/inquiry/TrainingInquiryForm'

type ServiceType = (typeof TRAINING_SERVICE_OPTIONS)[number]

const SERVICE_CARDS: Array<{ title: ServiceType; summary: string; fitCases: string[] }> = [
  {
    title: '연수기관 섭외만',
    summary: '연수 목적에 맞는 기관 조사·접촉·수용 가능 여부 확인 중심으로 지원합니다.',
    fitCases: ['일정의 큰 틀은 이미 잡혀 있습니다.', '방문기관 섭외만 별도로 필요합니다.', '목적에 맞는 기관 연결이 가장 중요합니다.'],
  },
  {
    title: '연수기획·진행 및 연수기관 섭외',
    summary: '목적 분석부터 구성 설계, 기관 섭외, 현장 진행까지 한 번에 검토하는 전체형 지원입니다.',
    fitCases: ['처음부터 방향을 함께 잡고 싶습니다.', '어떤 국가와 기관이 맞는지부터 고민 중입니다.', '일정과 기관섭외, 현장 운영까지 함께 맡기고 싶습니다.'],
  },
  {
    title: '연수기획·진행만',
    summary: '일부 조건이 있어도 연수 흐름과 운영 방향을 목적 중심으로 다시 설계합니다.',
    fitCases: ['기관이나 일정의 일부는 이미 정해져 있습니다.', '전체 연수 흐름과 진행 방향만 다시 잡고 싶습니다.', '목적에 맞는 연수 구성을 재정리할 필요가 있습니다.'],
  },
  {
    title: '순차통역만',
    summary: '기관방문·회의·연구시찰·취재 동행 등 현장 순차통역 중심으로 지원합니다.',
    fitCases: ['일정과 기관은 이미 확정되어 있습니다.', '현장 통역만 별도로 필요합니다.', '회의·방문·취재 상황에서 정확한 전달이 중요합니다.'],
  },
]

const FLOW_TITLES = ['문의 접수', '목적 확인 및 유관기관 조사', '연수 방향 및 기관방문 구성 제안', '통역 및 현장 운영 계획 안내', '사전 준비 및 방문 후 커뮤니케이션 지원'] as const
const FLOW_SUMMARIES = [
  '기본 정보를 확인하고 현재 준비 범위에서 상담을 시작합니다.',
  '목적 확인 후 유관기관 조사와 접촉 가능성을 실무적으로 검토합니다.',
  '국가·도시·기관 유형·동선 우선순위를 연수 목적 중심으로 제안합니다.',
  '현장 성격에 맞는 통역 방식과 운영 계획을 사전 설계합니다.',
  '사전 질의서·번역 지원과 방문 후 커뮤니케이션 협조까지 이어갑니다.',
] as const
const FLOW_DETAILS = [
  '기관명, 희망 국가, 연수 목적, 인원 등 기본 정보를 접수합니다. 세부 조건이 모두 확정되지 않아도 접수 가능합니다.',
  '필요 시 서면 요청과 직접 통화로 목적 부합성·수용 가능 여부를 확인합니다.',
  '관광형 일정이 아니라 연수 목적 중심으로 방문 흐름을 재구성합니다.',
  '기관방문·회의·연구시찰은 순차통역 중심으로 준비하며, 사전질의서 기반 언어 준비를 함께 진행합니다.',
  '현장 중 이슈 조율과 방문 후 후속 커뮤니케이션 연결까지 지원합니다.',
] as const

type TrainingHubProps = {
  /** 메인 허브 `training`과 동일 하이브리드 해석 URL */
  heroImageUrl: string
  /** 통역 블록 — 관리자 `trainingPageSecondaryImage` 없으면 hero와 동일 */
  interpretImageUrl: string
}

const TRUST_CASES = [
  '수원시의회 보건복지위원회 · 국외연수',
  '경기도의회 ODA 에티오피아 · 국외연수',
  '경기도의회 미래과학위원회 · 국외연수',
  '경기도의회 교육행정위원회 · 국외연수',
  '경기도청 세정과 · 국외연수',
  '경기도청 조세정의과 · 국외연수',
  '언론사 특별취재 · 동행 순차통역',
] as const

const SERVICE_MODAL_HINT: Record<ServiceType, { hint: string }> = {
  '연수기관 섭외만': {
    hint: '연수 목적에 맞는 기관 조사, 서면 요청, 직접 연락, 방문 가능 여부 확인 중심으로 상담해드립니다.',
  },
  '연수기획·진행 및 연수기관 섭외': {
    hint: '연수 목적 분석부터 전체 구성, 기관 조사와 섭외, 현장 진행까지 함께 검토하는 전체형 문의입니다.',
  },
  '연수기획·진행만': {
    hint: '연수 목적에 맞는 전체 흐름과 진행 방향을 다시 설계할 수 있도록 상담해드립니다.',
  },
  '순차통역만': {
    hint: '기관방문, 회의, 연구시찰, 특별취재 동행 등 현장에서 필요한 순차통역 중심으로 상담해드립니다.',
  },
}

export default function TrainingHub({ heroImageUrl, interpretImageUrl }: TrainingHubProps) {
  const [presetService, setPresetService] = useState<ServiceType | null>(null)
  const [inquiryOpen, setInquiryOpen] = useState(false)

  const inquiryQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set('type', 'training')
    if (presetService) params.set('service', presetService)
    return `/inquiry?${params.toString()}`
  }, [presetService])

  const moveToInquiry = (service: ServiceType | null) => {
    setPresetService(service)
    setInquiryOpen(true)
  }

  const modalMeta = presetService
    ? {
        title: '문의하기',
        description: SERVICE_MODAL_HINT[presetService].hint,
      }
    : {
        title: '문의하기',
        description:
          '기관·학교·단체 목적에 맞는 국외연수 방향을 상담해드립니다. 필요한 서비스 범위를 선택하고 현재 준비된 내용을 남겨 주세요.',
      }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <section className="border-b border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Overseas Training</p>
              <h1 className="bt-wrap mt-2 max-w-xl text-[clamp(2rem,5.4vw,3.35rem)] font-semibold leading-[1.28] tracking-[-0.01em] text-slate-900 sm:max-w-2xl sm:leading-[1.22] lg:leading-[1.16]">
                <span className="block [text-wrap:pretty]">국외연수는 여행이 아니라,</span>
                <span className="mt-1 block [text-wrap:pretty]">목적에 맞는 연수기획과 진행입니다.</span>
              </h1>
              <p className="bt-wrap mt-5 max-w-2xl text-[20px] font-semibold leading-[1.55] text-slate-800 [text-wrap:pretty]">
                Bong투어는 연수기획·진행, 연수기관 섭외, 순차통역까지 실무 중심으로 함께합니다.
              </p>
              <p className="bt-wrap mt-5 max-w-2xl text-[18px] leading-[1.75] text-slate-700 [text-wrap:pretty]">
                국외연수는 단순 이동·숙박 준비가 아니라 목적에 맞는 기관 연결과 현장 운영 준비까지 포함됩니다. Bong투어는 목적 확인부터 기관 조사·섭외, 순차통역·현장 운영까지 실무 흐름으로 지원합니다.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => moveToInquiry(null)} className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-[16px] font-semibold text-white hover:bg-slate-800">
                  국외연수 문의하기
                </button>
                <button type="button" onClick={() => document.getElementById('training-service-scope')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[16px] font-semibold text-slate-800 hover:bg-slate-50">
                  필요한 서비스 확인하기
                </button>
              </div>
            </div>
            <div>
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative h-[320px] sm:h-[380px] lg:h-[440px]">
                  <Image
                    src={heroImageUrl}
                    alt="국외연수 서비스 안내 이미지"
                    fill
                    sizes="(max-width: 1023px) 100vw, 544px"
                    className="object-cover"
                  />
                </div>
              </div>
              <p className="mt-2 text-right text-xs text-slate-500">사진은 기존 사진을 AI로 변형한 내용입니다.</p>
            </div>
          </div>
        </section>

        <section className="border-b border-bt-border bg-slate-50/90 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              공공·기관 예산 집행 기준에 맞춘 발권 및 증빙 안내
            </h2>
            <p className="bt-wrap mt-3 max-w-3xl text-[17px] leading-[1.7] text-slate-700">
              국외연수는 항공 발권, 증빙, 확인 서류, 예산 집행 흐름까지 함께 검토해야 하는 경우가 많습니다. Bong투어는
              진행 상황에 맞춰 필요한 내용을 안내드립니다.
            </p>
            <Link
              href="/air-ticketing"
              className="mt-4 inline-flex text-[15px] font-semibold text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
            >
              항공권 예매 및 발권 안내 보기
            </Link>
          </div>
        </section>

        <section id="training-service-scope" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">필요한 범위에 맞춰 문의하실 수 있습니다.</h2>
          <p className="mt-3 text-[18px] leading-relaxed text-slate-700">전체 연수를 처음부터 함께 준비하는 경우뿐 아니라, 연수기관 섭외만, 연수기획·진행만, 순차통역만처럼 필요한 범위에 맞춰 문의하실 수 있습니다. 현재 준비 상태와 목적에 맞는 유형을 선택해 주세요.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SERVICE_CARDS.map((card) => (
              <article key={card.title} className="rounded-xl border border-bt-border bg-white p-5 shadow-sm">
                <p className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {card.title === '연수기관 섭외만'
                    ? '기관 연결 중심'
                    : card.title === '연수기획·진행 및 연수기관 섭외'
                      ? '전체 운영형'
                      : card.title === '연수기획·진행만'
                        ? '기획·진행 중심'
                        : '현장 통역형'}
                </p>
                <h3 className="mt-3 text-[26px] font-semibold leading-[1.34] tracking-[-0.005em] text-slate-900">{card.title}</h3>
                <p className="mt-3 text-[17px] leading-[1.6] text-slate-700">{card.summary}</p>
                <button type="button" onClick={() => moveToInquiry(card.title)} className="mt-4 inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-[16px] font-semibold text-slate-800 hover:bg-slate-50">
                  문의하기
                </button>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">추가 정보 보기</summary>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {card.fitCases.map((c) => (
                      <li key={c}>- {c}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-bt-border bg-bt-surface px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">문의 후 이런 흐름으로 진행됩니다.</h2>
            <p className="mt-3 text-[18px] leading-relaxed text-slate-700">국외연수는 단순 문의 접수로 끝나지 않습니다. 목적을 확인하고, 필요한 기관을 조사하고, 현장 운영과 이후 커뮤니케이션까지 이어질 수 있도록 단계별로 함께 준비합니다.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-5 md:gap-5">
              {FLOW_SUMMARIES.map((summary, idx) => (
                <article
                  key={FLOW_TITLES[idx]}
                  className={`relative flex min-h-[320px] flex-col rounded-2xl border bg-white p-4 pt-6 md:min-h-[360px] ${
                    idx === 1 || idx === 3 || idx === 4
                      ? 'border-blue-300 bg-blue-50/55 shadow-[0_8px_24px_rgba(37,99,235,0.08)]'
                      : 'border-bt-border'
                  }`}
                >
                  <span
                    className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl ${
                      idx === 1 || idx === 3 || idx === 4 ? 'bg-blue-500' : 'bg-slate-200'
                    }`}
                    aria-hidden
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${
                        idx === 1 || idx === 3 || idx === 4
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <p
                      className={`text-xs font-semibold tracking-wide ${
                        idx === 1 || idx === 3 || idx === 4 ? 'text-blue-900' : 'text-slate-600'
                      }`}
                    >
                      STEP
                    </p>
                  </div>
                  <h3 className="mt-2 min-h-[56px] text-[19px] font-semibold leading-[1.36] tracking-[-0.003em] text-slate-900">
                    {FLOW_TITLES[idx]}
                  </h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-slate-700">{summary}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">자세히 보기</summary>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{FLOW_DETAILS[idx]}</p>
                  </details>
                  {idx < FLOW_SUMMARIES.length - 1 ? (
                    <span className="absolute -right-5 top-8 hidden items-center md:flex" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                      <span className="mx-1 h-0.5 w-5 bg-blue-300" />
                      <span className="text-sm text-blue-500">➜</span>
                    </span>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">현장에서는 통역 방식과 운영 이해가 중요합니다.</h2>
          <p className="mt-3 text-[18px] leading-relaxed text-slate-700">현장 성격에 따라 통역 방식과 운영 준비가 달라집니다. Bong투어는 사전질의서와 고객사 의도를 기준으로 현장 흐름에 맞춰 준비합니다.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative h-[280px] sm:h-[340px]">
                <Image
                  src={interpretImageUrl}
                  alt="국외연수 회의·브리핑 장면"
                  fill
                  sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 46vw, 544px"
                  className="object-cover"
                />
              </div>
              <p className="px-4 py-2 text-right text-xs text-slate-500">사진은 기존 사진을 AI로 변형한 내용입니다.</p>
            </div>
            <div className="grid gap-4">
              <article className="rounded-xl border border-bt-border bg-white p-5">
                <h3 className="text-[26px] font-semibold leading-[1.34] tracking-[-0.005em] text-slate-900">동시통역</h3>
                <p className="mt-2 text-[17px] leading-[1.62] text-slate-700">사전 의제가 정리된 발표·행사에서 실시간 전달이 필요한 경우에 사용됩니다.</p>
              </article>
              <article className="rounded-xl border border-bt-border bg-white p-5">
                <h3 className="text-[26px] font-semibold leading-[1.34] tracking-[-0.005em] text-slate-900">순차통역</h3>
                <p className="mt-2 text-[17px] leading-[1.62] text-slate-700">기관 방문·회의·연구시찰처럼 현장 커뮤니케이션이 중요한 상황에서 주로 사용됩니다.</p>
              </article>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-[18px] font-semibold leading-[1.48] text-slate-800">국외연수 현장에서는 순차통역 경험이 실제 운영 품질을 좌우합니다.</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800">통역 운영 상세 보기</summary>
            <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-4 text-[16px] leading-[1.68] text-slate-700 sm:px-5 [word-break:keep-all]">
              <div className="[text-wrap:pretty]">
                <p className="text-[13px] font-semibold tracking-wide text-slate-800">사전 준비</p>
                <p className="mt-1.5">
                  Bong투어는 고객사의 방문 목적과 사전질의서 내용을 바탕으로 필요한 용어와 표현을 미리 정리한 뒤 현장에 참여합니다.
                </p>
              </div>
              <div className="border-t border-slate-200 pt-4 [text-wrap:pretty]">
                <p className="text-[13px] font-semibold tracking-wide text-slate-800">현장 통역</p>
                <p className="mt-1.5">
                  기관 방문, 회의, 연구시찰 등 실제 상황에 맞춰 순차통역을 진행합니다.
                </p>
              </div>
              <div className="border-t border-slate-200 pt-4 [text-wrap:pretty]">
                <p className="text-[13px] font-semibold tracking-wide text-slate-800">운영 지원</p>
                <p className="mt-1.5">
                  고객사의 의도와 현장 흐름이 자연스럽게 이어질 수 있도록 운영 전반을 안정적으로 지원합니다.
                </p>
              </div>
            </div>
          </details>
        </section>

        <section className="border-y border-bt-border bg-bt-surface px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">실제 수행기관명을 기준으로 신뢰를 쌓아왔습니다.</h2>
            <p className="mt-3 text-[18px] leading-relaxed text-slate-700">Bong투어는 기관명을 흐리게 감추는 방식보다 실제 수행 경험을 정확하게 드러내는 방식을 택합니다. 국외연수는 추상적인 소개보다 누가, 어떤 목적으로, 어떤 방식의 수행을 맡았는지가 더 중요하기 때문입니다.</p>
            <p className="mt-4 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">2025 수행기관</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TRUST_CASES.map((t) => (
                <div key={t} className="rounded-lg border border-bt-border bg-white px-4 py-3 text-base text-slate-800">
                  {t}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[17px] leading-relaxed text-slate-700">경기도의회 미래과학협력위원회의 싱가포르·항저우 공무국외출장은 언론에서 ‘국외 출장의 정석’으로 소개된 사례로, 목적 중심의 기관 방문 구성과 운영 경험을 보여줍니다. Bong투어는 실제 기관 수행 경험을 바탕으로, 형식적인 일정이 아니라 목적에 맞는 방문 구성과 현장 운영을 지원합니다.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-5">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">아직 모두 정해지지 않아도 문의하실 수 있습니다.</h2>
              <ul className="mt-3 space-y-2 text-[18px] text-slate-700">
                <li>일정이나 예산이 아직 확정되지 않아도 괜찮습니다.</li>
                <li>전체 연수 운영뿐 아니라 필요한 범위만 선택해 문의할 수 있습니다.</li>
                <li>연수 목적에 따라 어떤 구성이 필요한지부터 함께 검토할 수 있습니다.</li>
              </ul>
              <p className="mx-auto mt-3 max-w-2xl text-[17px] text-slate-700">처음부터 모든 조건을 정리해 오실 필요는 없습니다. 현재 준비된 범위 안에서 남겨주시면 목적에 맞는 방향부터 함께 확인해드립니다.</p>
              <div className="mt-5 flex justify-center">
                <button type="button" onClick={() => moveToInquiry(presetService)} className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-7 py-3.5 text-[17px] font-semibold text-white hover:bg-slate-800">
                문의하기
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>
      {inquiryOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-3 sm:p-6">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                {presetService ? (
                  <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                    {presetService}
                  </p>
                ) : null}
                <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{modalMeta.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{modalMeta.description}</p>
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
                  productId: null,
                  monthlyCurationItemId: null,
                  snapshotProductTitle: null,
                  snapshotCardLabel: null,
                  targetYearMonth: null,
                  trainingServiceScope: null,
                }}
                presetService={presetService}
                overlayMeta={modalMeta}
                serviceBadgeLabel={presetService}
              />
              <p className="px-4 pb-5 text-center text-sm text-slate-600 sm:px-6">
                문의 내용을 바탕으로 담당자가 검토 후 순차적으로 안내드립니다. 예약 확정이 아닌 상담 및 진행 가능 여부 확인
                단계입니다.
              </p>
            </div>
            <div className="border-t border-slate-200 px-4 py-3 text-center sm:px-6">
              <Link
                href={inquiryQuery}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                전체 문의페이지로 열기
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
