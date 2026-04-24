import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from '@/lib/bongsim/constants'

export const metadata: Metadata = {
  title: 'eSIM 설치 가이드',
  description:
    'Bong투어 eSIM을 구매하신 뒤 설치·개통 순서를 안내해요. 출국 전 국내 설치, 현지 도착 후 개통 등 상품별 기준을 확인하세요.',
  alternates: { canonical: '/travel/esim/help/setup-guide' },
  robots: { index: true, follow: true },
}

type QA = {
  tone: 'teal' | 'orange' | 'slate'
  badge: string
  question: string
  answer: string
}

const QNA: QA[] = [
  {
    tone: 'teal',
    badge: '출국 전',
    question: '구매한 eSIM, 미리 설치해도 될까요?',
    answer:
      '대부분의 eSIM은 출국 전 국내에서 프로파일 설치가 가능해요. 구매 즉시 이메일로 QR코드가 발송되니, 여행 준비 중 여유롭게 설치해 두세요. 데이터 사용 시작 시점은 상품별로 다르니 상세 페이지의 사용 기준을 꼭 확인해 주세요.',
  },
  {
    tone: 'orange',
    badge: '국내 설치',
    question: '국내에서 설치해도 되나요?',
    answer:
      '프로파일 설치(QR 스캔)는 국내에서도 가능한 상품이 많아요. 다만 설치 직후부터 데이터 사용이 시작되는 상품은 현지 도착 후 설치를 권장해요. 상품 상세의 “사용 기준”에 설치·개통 시점이 명시되어 있으니 구매 전 확인해 주세요.',
  },
  {
    tone: 'slate',
    badge: '현지 도착 후',
    question: '출국 전 설치하면 안 되는 상품도 있나요?',
    answer:
      '일부 로컬망 상품은 현지 네트워크에 접속한 시점부터 카운팅이 시작돼요. 이 경우 국내에서 미리 설치하면 사용 기간이 줄어들 수 있으니, 공항 도착 직후 기내에서 QR을 스캔하는 것이 가장 안전해요. 상품별 안내 문구를 꼭 확인해 주세요.',
  },
]

function toneClass(tone: QA['tone']): { wrap: string; badge: string } {
  if (tone === 'teal') {
    return {
      wrap: 'border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white',
      badge: 'bg-teal-600 text-white',
    }
  }
  if (tone === 'orange') {
    return {
      wrap: 'border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white',
      badge: 'bg-orange-500 text-white',
    }
  }
  return {
    wrap: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white',
    badge: 'bg-slate-900 text-white',
  }
}

export default function EsimSetupGuidePage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main>
        <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-28 lg:pt-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700">
            eSIM 설치 가이드
          </p>
          <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl lg:text-[1.75rem]">
            언제 설치해야 할지, 한눈에 알려드릴게요
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
            Bong투어 eSIM은 상품마다 설치·개통 기준이 조금씩 달라요. 출국 전 준비부터 현지 도착 후까지,
            자주 묻는 세 가지 상황을 정리했어요.
          </p>

          <section aria-label="설치 시점 Q&A" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {QNA.map((item) => {
              const tone = toneClass(item.tone)
              return (
                <article
                  key={item.question}
                  className={`flex flex-col rounded-2xl border p-5 shadow-sm sm:p-6 ${tone.wrap}`}
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.badge}`}
                  >
                    {item.badge}
                  </span>
                  <h2 className="mt-3 text-[15px] font-bold leading-snug text-slate-900 sm:text-base">
                    {item.question}
                  </h2>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-700">{item.answer}</p>
                </article>
              )
            })}
          </section>

          <section
            className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:rounded-3xl lg:p-7"
            aria-label="추가 안내"
          >
            <h2 className="text-base font-bold text-slate-900 lg:text-lg">그 외에 알아두면 좋아요</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate-700">
              <li>설치는 QR 스캔 한 번이면 끝. 별도의 앱 설치는 필요하지 않아요.</li>
              <li>개통 후에는 기존 유심(통화/문자용)을 그대로 두고 데이터만 eSIM으로 사용해요.</li>
              <li>설치 중 QR 인식이 되지 않으면, 이메일의 수동 입력 정보(SM-DP+ 주소·활성화 코드)를 사용해 주세요.</li>
              <li>여행을 마친 뒤에는 eSIM 프로파일을 삭제하셔도 되고, 남겨 두셨다가 다음 여행 때 재사용하셔도 돼요(상품별 상이).</li>
            </ul>
          </section>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Link
              href={bongsimPath('/help/device-compatibility')}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50/70 px-5 text-[14px] font-bold text-teal-900 transition hover:bg-teal-100"
            >
              이용 가능 기기 확인하기
            </Link>
            <Link
              href={bongsimPath()}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-700 px-5 text-[14px] font-bold text-white shadow-md transition hover:bg-teal-800"
            >
              eSIM 다시 둘러보기
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
