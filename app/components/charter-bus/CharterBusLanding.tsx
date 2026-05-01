'use client'

import { useState } from 'react'
import SafeImage from '@/app/components/SafeImage'
import Header from '@/app/components/Header'
import BusInquiryForm from '@/components/inquiry/BusInquiryForm'

const USE_CASES = [
  {
    title: '기업/기관 이동',
    description: '워크숍, 연수, 외부 일정, 현장 방문 등 단체 이동이 필요한 경우에 적합합니다.',
  },
  {
    title: '학교/학원 일정',
    description: '체험학습, 수학여행, 단체 행사 등 학생 이동 중심 일정에 활용할 수 있습니다.',
  },
  {
    title: '행사/모임 이동',
    description: '결혼식 하객 이동, 지역 행사, 단체 모임 등 지정 장소 이동이 필요한 경우에 이용합니다.',
  },
  {
    title: '관광/자유 일정 이동',
    description: '단체 관광, 지방 이동, 1일 일정처럼 동선을 맞춤으로 구성해야 할 때 적합합니다.',
  },
] as const

const QUOTE_FACTORS = [
  '이용 인원',
  '출발지 / 도착지',
  '이용 날짜',
  '출발 시간 / 종료 예상 시간',
  '왕복·대기 포함 여부',
  '경유지 여부',
  '차량 종류(9인승 / 25인승 / 28인승 / 45인승 등)',
  '기사 대기 시간 여부',
] as const

const FLOW_STEPS = [
  { title: '기본 정보 접수', desc: '이용 날짜, 인원, 출발지/도착지, 일정 정보를 확인합니다.' },
  { title: '조건 확인', desc: '차량 종류, 대기 여부, 경유지, 이용 시간 등 견적에 필요한 조건을 검토합니다.' },
  { title: '가능 여부 및 견적 안내', desc: '운행 가능 여부와 예상 견적 방향을 상담해드립니다.' },
  { title: '일정 조율', desc: '세부 동선이나 시간을 조정해야 하는 경우 상담을 통해 정리합니다.' },
  { title: '접수 및 진행 안내', desc: '확정 가능한 범위를 기준으로 후속 절차를 안내드립니다.' },
] as const

type VehicleCard = {
  name: string
  summary: string
  useCase: string
  imageSrc: string | null
  imageAlt: string | null
  /** 우측 하단 AI 생성 안내 표시 */
  aiGenerated?: boolean
}

const VEHICLE_CARDS: VehicleCard[] = [
  {
    name: '45인승',
    summary: '단체 연수, 행사 이동, 관광 일정 등 인원이 많은 일정에 적합한 차량입니다.',
    useCase: '대규모 단체 이동',
    imageSrc: '/images/charter-bus/charter-45-bus.webp',
    imageAlt: 'Bong투어 45인승 전세버스 외관',
    aiGenerated: true,
  },
  {
    name: '28인승 리무진 대형 버스',
    summary: '기관 방문, 기업 이동, 중규모 일정처럼 인원과 이동 편의가 함께 중요한 경우에 적합합니다.',
    useCase: '중규모 기관/기업 일정',
    imageSrc: '/images/charter-bus/charter-28-limousine.webp',
    imageAlt: 'Bong투어 28인승 리무진 대형 전세버스 외관',
    aiGenerated: true,
  },
  {
    name: '25인승 콤비',
    summary: '소규모 단체 일정이나 기관 방문, 지역 이동, 공항 이동 등에 유연하게 활용할 수 있는 차량입니다.',
    useCase: '소규모 단체 이동',
    imageSrc: '/images/charter-bus/charter-25-combi.webp',
    imageAlt: 'Bong투어 25인승 콤비 외관',
  },
  {
    name: '9인승 스타리아',
    summary: '소규모 팀 이동, 공항 이동, 임원 이동, 맞춤형 일정에 적합한 차량입니다.',
    useCase: '소규모 팀/임원 이동',
    imageSrc: '/images/charter-bus/charter-9-staria.webp',
    imageAlt: 'Bong투어 9인승 스타리아 외관',
  },
]

export default function CharterBusLanding() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <section className="border-b border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Charter bus</p>
            <h1 className="bt-wrap mt-2 text-[clamp(1.35rem,4vw,2.25rem)] font-semibold leading-[1.35] tracking-tight text-slate-900 sm:text-4xl">
              전세버스는 일정에 맞는 차량과 이동 계획이 중요합니다
            </h1>
            <p className="bt-wrap mt-3 text-lg font-semibold text-slate-800 sm:text-xl">
              일반 예매부터 법인카드 결제, 증빙 확인까지 상황에 맞게 안내해드립니다
            </p>
            <div className="mx-auto mt-5 max-w-2xl space-y-3 text-center text-[17px] leading-[1.75] text-slate-700">
              <p className="bt-wrap [text-wrap:pretty]">
                행사, 연수, 기업 이동, 학교 일정, 관광 일정에 맞춰 전세버스 이용 가능 여부와 견적 방향을 상담해드립니다.
              </p>
              <p className="bt-wrap [text-wrap:pretty]">
                차량 종류뿐 아니라 인원, 출발지/도착지, 이동 동선, 대기 여부, 일정 시간까지 함께 확인해 진행합니다.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => document.getElementById('charter-factors')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold !text-slate-900 shadow-sm hover:bg-slate-50 sm:text-base"
              >
                견적 기준 확인하기
              </button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-[15px] font-semibold text-white hover:bg-slate-800 sm:text-base"
              >
                전세버스 문의하기
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">이런 일정에 전세버스를 이용합니다.</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {USE_CASES.map((c) => (
              <article key={c.title} className="rounded-xl border border-bt-border bg-white p-5 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-slate-700">{c.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">운용 차량 안내</h2>
              <p className="mt-3 text-[17px] leading-[1.7] text-slate-700">
                이용 인원과 일정 성격에 맞춰 차량을 제안해드립니다.
                <br />
                출발 인원, 이동 목적, 짐 여부, 동선에 따라 적합한 차량이 달라질 수 있습니다.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {VEHICLE_CARDS.map((v) => (
                <article key={v.name} className="overflow-hidden rounded-xl border border-bt-border bg-white shadow-sm">
                  {v.imageSrc ? (
                    <div className="relative h-[180px] w-full">
                      <SafeImage src={v.imageSrc} alt={v.imageAlt ?? v.name} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw" className="object-cover" />
                      {v.aiGenerated ? (
                        <p className="pointer-events-none absolute bottom-1 right-1 whitespace-nowrap rounded bg-black/45 px-1.5 py-0.5 text-[7px] font-medium leading-tight text-white/95 shadow-sm backdrop-blur-[1px] sm:bottom-1.5 sm:right-1.5 sm:text-[8px]">
                          AI로 생성되었습니다.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="h-[180px] w-full bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)]">
                      <div className="flex h-full items-end p-4">
                        <p className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          중규모 일정 추천
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-xs font-semibold text-slate-500">{v.useCase}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{v.name}</h3>
                    <p className="mt-2 text-sm leading-[1.6] text-slate-700">{v.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="charter-factors" className="border-y border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">견적은 이런 기준으로 달라집니다.</h2>
              <p className="mt-3 text-[17px] leading-[1.7] text-slate-700">
                전세버스 견적은 차량 종류만으로 정해지지 않습니다. 이용 인원, 이동 거리, 시간, 대기 여부, 경유지 유무에 따라 조건이 달라지므로 기본 정보를 함께 확인해야 합니다.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {QUOTE_FACTORS.map((f) => (
                <div key={f} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800">
                  {f}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[38px]">문의 후 이런 흐름으로 진행됩니다.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-5 md:gap-5">
            {FLOW_STEPS.map((step, idx) => (
              <article key={step.title} className="relative flex min-h-[220px] flex-col rounded-xl border border-bt-border bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">STEP</span>
                </div>
                <h3 className="mt-2 text-base font-semibold leading-[1.35] text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-[1.6] text-slate-700">{step.desc}</p>
                {idx < FLOW_STEPS.length - 1 ? (
                  <span className="absolute -right-5 top-8 hidden items-center md:flex" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    <span className="mx-1 h-0.5 w-5 bg-blue-300" />
                    <span className="text-sm text-blue-500">➜</span>
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 sm:p-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-semibold text-slate-900 max-sm:whitespace-nowrap max-sm:tracking-tight max-sm:text-[clamp(8px,2.8vw,2.375rem)] max-sm:leading-tight sm:tracking-tight sm:text-[38px] sm:leading-[1.3]">
                대략적인 이동 계획만 있어도 상담을{' '}
                <span className="whitespace-nowrap">시작할 수 있습니다.</span>
              </h2>
              <ul className="mx-auto mt-4 max-w-2xl list-none space-y-3 pl-0 text-[16px] leading-[1.65] text-slate-700 sm:mt-5 sm:text-[17px] sm:leading-[1.7]">
                <li>인원, 시간, 동선이 아직 조정 중이어도 문의 가능합니다.</li>
                <li>출발지·도착지·이용 날짜 정도만 있어도 차량과 견적 방향을 검토할 수 있습니다.</li>
                <li>경유지, 대기 여부, 왕복 조건은 상담 과정에서 함께 정리해드립니다.</li>
              </ul>
              <div className="mt-6 flex justify-center sm:mt-7">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-7 py-3.5 text-[17px] font-semibold text-white hover:bg-slate-800"
                >
                  문의하기
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 p-3 sm:p-6">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">전세버스 문의하기</h2>
                <p className="mt-1 text-sm text-slate-600">
                  이용 날짜, 인원, 출발지와 도착지 등 기본 정보를 남겨주시면 전세버스 이용 가능 여부와 견적 방향을 상담해드립니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[calc(92vh-72px)] overflow-y-auto">
              <BusInquiryForm
                initialQuery={{
                  productId: null,
                  monthlyCurationItemId: null,
                  snapshotProductTitle: null,
                  snapshotCardLabel: null,
                  targetYearMonth: null,
                  trainingServiceScope: null,
                }}
                overlayMeta={{
                  title: '전세버스 문의하기',
                  description:
                    '예상 인원만으로도 접수할 수 있습니다. 왕복 기준이며, 일정·노선은 상담하면서 정리해 드립니다.',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

