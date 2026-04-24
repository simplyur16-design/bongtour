import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from '@/lib/bongsim/constants'

export const metadata: Metadata = {
  title: 'eSIM 이용 가능 기기',
  description:
    'iPhone·Galaxy·Pixel 등 Bong투어 eSIM을 사용할 수 있는 기기를 정리했어요. 구매 전 내 스마트폰의 eSIM 지원 여부를 꼭 확인해 주세요.',
  alternates: { canonical: '/travel/esim/help/device-compatibility' },
  robots: { index: true, follow: true },
}

type DeviceGroup = {
  brand: string
  tagline: string
  models: string[]
  note?: string
}

/**
 * 출처: Apple·Samsung·Google 각 제조사 공식 지원 문서.
 * 국내 출시 모델 기준. 자급제·통신사 구입·해외 직구 단말은 개별 확인 필요.
 */
const DEVICES: DeviceGroup[] = [
  {
    brand: 'Apple iPhone',
    tagline: '2018년 출시된 iPhone XR · XS 이후 모든 모델이 eSIM을 지원해요.',
    models: [
      'iPhone 17 시리즈 / iPhone Air / iPhone 17e',
      'iPhone 16 시리즈',
      'iPhone 15 시리즈',
      'iPhone 14 시리즈',
      'iPhone 13 시리즈 (듀얼 eSIM 지원 시작)',
      'iPhone 12 시리즈',
      'iPhone 11 시리즈',
      'iPhone SE (2·3세대)',
      'iPhone XR · XS · XS Max',
    ],
    note: 'iPhone 13 이후 모델은 eSIM 2개 동시 활성화가 가능해요. iPhone X 및 이전 모델은 eSIM을 지원하지 않아요.',
  },
  {
    brand: 'Samsung Galaxy (국내 출시 모델)',
    tagline: '국내는 2022년 하반기부터 본격 지원. Z Fold4·Flip4 / S23 시리즈 이후 모델에서 쓸 수 있어요.',
    models: [
      'Galaxy S25 시리즈 / S25 Ultra',
      'Galaxy S24 시리즈 / S24 Ultra',
      'Galaxy S23 시리즈 / S23 Ultra / S23 FE',
      'Galaxy Z Fold 6 · 5 · 4',
      'Galaxy Z Flip 6 · 5 · 4',
    ],
    note: 'Galaxy S22 이전 국내 출시 모델은 eSIM을 지원하지 않아요. 일부 해외판은 규격이 다를 수 있으니 설정 > 연결 > SIM 관리자에서 “eSIM 추가” 메뉴가 보이는지 확인해 주세요.',
  },
  {
    brand: 'Google Pixel',
    tagline: 'Pixel 3 이후 모델이 eSIM을 지원해요.',
    models: [
      'Pixel 9 · 9 Pro · 9 Pro XL',
      'Pixel 8 · 8 Pro · 8a',
      'Pixel 7 · 7 Pro · 7a',
      'Pixel 6 · 6 Pro · 6a',
      'Pixel 5 · 5a / Pixel 4 · 4a · 4 XL',
      'Pixel 3 · 3 XL · 3a · 3a XL (일부 지역 버전 제외)',
    ],
    note: '호주·대만·일본 등 특정 지역 판매 버전의 Pixel 3은 eSIM이 제한될 수 있어요.',
  },
]

export default function EsimDeviceCompatibilityPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main>
        <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-28 lg:pt-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700">
            eSIM 이용 가능 기기
          </p>
          <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl lg:text-[1.75rem]">
            구매 전에, 내 폰이 eSIM을 지원하는지 확인해 주세요
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
            eSIM 미지원 기기를 모르고 구매하면 현지에서 연결이 되지 않을 수 있어요. 출발 전 1분만 투자해
            확인해 두시면 편안한 여행이 됩니다.
          </p>

          {/* 빠른 체크 */}
          <section
            aria-label="내 폰 빠르게 확인하기"
            className="mt-8 rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-6 shadow-sm sm:p-8"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">1분 체크</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">내 폰이 eSIM 되는지 바로 확인</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
                <p className="text-[13px] font-bold text-slate-900">iPhone 사용자</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                  설정 → 셀룰러(또는 모바일 데이터) → <strong>&quot;eSIM 추가&quot;</strong> 메뉴가 보이면 지원 기기예요.
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
                <p className="text-[13px] font-bold text-slate-900">Galaxy · Pixel 사용자</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                  설정 → 연결 → <strong>SIM 관리자</strong> 또는 <strong>SIM 카드 및 모바일 네트워크</strong> →
                  <strong> &quot;eSIM 추가&quot;</strong> 메뉴가 있으면 지원 기기예요.
                </p>
              </div>
            </div>
          </section>

          {/* 제조사별 지원 기종 */}
          <section aria-label="제조사별 지원 기종" className="mt-10 space-y-5">
            <h2 className="text-base font-bold text-slate-900 lg:text-lg">제조사별 지원 기종</h2>
            {DEVICES.map((g) => (
              <article
                key={g.brand}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:rounded-3xl lg:p-7"
              >
                <h3 className="text-[15px] font-bold text-slate-900 sm:text-base">{g.brand}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">{g.tagline}</p>
                <ul className="mt-4 grid gap-1.5 text-[13px] leading-relaxed text-slate-700 sm:grid-cols-2">
                  {g.models.map((m) => (
                    <li key={m} className="flex items-start gap-1.5">
                      <span className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-teal-500" aria-hidden />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
                {g.note ? (
                  <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-slate-600 sm:text-[12px]">
                    <span className="font-bold text-slate-800">참고.</span> {g.note}
                  </p>
                ) : null}
              </article>
            ))}
          </section>

          {/* 주의사항 */}
          <section
            className="mt-10 rounded-2xl border border-orange-100 bg-orange-50/50 p-5 shadow-sm sm:p-6"
            aria-label="주의가 필요한 경우"
          >
            <h2 className="text-base font-bold text-slate-900 lg:text-lg">이런 분들은 한 번 더 체크!</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate-700">
              <li>중국 본토 내수용 iPhone (대부분 eSIM 미지원)</li>
              <li>해외 직구 또는 현지 구매한 단말 (지역 버전에 따라 지원 스펙이 달라요)</li>
              <li>통신사 약정으로 구매해 아직 잠금(락)이 풀리지 않은 단말</li>
              <li>2018년 이전에 출시된 스마트폰 대부분</li>
              <li>eSIM 메뉴 자체가 보이지 않는 단말</li>
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-slate-600">
              확실하지 않을 땐 구매 전 Bong투어 고객지원으로 먼저 문의해 주세요. 맞지 않는 상품이 발송되기 전에
              함께 확인해 드릴게요.
            </p>
          </section>

          {/* eSIM 안 될 때 안내 */}
          <section
            className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            aria-label="eSIM이 안 되는 경우"
          >
            <h2 className="text-base font-bold text-slate-900 lg:text-lg">eSIM 지원 기기가 아니라면?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
              eSIM이 지원되지 않는 단말이라면 기존 물리 USIM 방식 로밍 상품이나, 현지 공항 수령 USIM도 고려하실 수
              있어요. 여행 일정·사용량에 맞춰 Bong투어 고객센터에서 안내해 드립니다.
            </p>
          </section>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Link
              href={bongsimPath('/help/setup-guide')}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50/70 px-5 text-[14px] font-bold text-teal-900 transition hover:bg-teal-100"
            >
              설치 가이드 보기
            </Link>
            <Link
              href={bongsimPath()}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-700 px-5 text-[14px] font-bold text-white shadow-md transition hover:bg-teal-800"
            >
              eSIM 다시 둘러보기
            </Link>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
            ※ 위 목록은 Apple·Samsung·Google 공식 지원 문서를 참고해 Bong투어가 정리한 내용이에요. 제조사 정책에
            따라 일부 지역 판매 버전은 예외가 있을 수 있으니, 최종 확인은 내 단말의 설정 메뉴에서 해 주세요.
          </p>
        </div>
      </main>
    </div>
  )
}
