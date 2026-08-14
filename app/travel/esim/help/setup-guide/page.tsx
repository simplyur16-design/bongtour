import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import { bongsimPath } from '@/lib/bongsim/constants'

export const metadata: Metadata = {
  title: 'eSIM 설치 가이드',
  description:
    'Bong투어 eSIM — 초보도 OK. 출국 전 설치, 요금 폭탄 방지, QR 1회성까지 한눈에 안내합니다.',
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
      '대부분의 eSIM은 출국 전 국내에서 프로파일 설치가 가능해요. 결제 후 카카오 알림톡·이메일·마이페이지에서 QR·바로 설치를 받을 수 있으니, 여유 있을 때 설치해 두세요. 다만 설치 순간부터 기간이 시작되는 상품도 있으니 상세 안내를 꼭 확인하세요.',
  },
  {
    tone: 'orange',
    badge: '요금 폭탄 방지',
    question: '해외에서 국내 유심 로밍은 어떻게 하나요?',
    answer:
      '해외에서는 국내 유심의 데이터 로밍을 끄고, 모바일 데이터는 Bong투어 eSIM만 사용하세요. 유심 로밍이 켜져 있으면 국내 통신사 요금이 나갈 수 있어요. 통화·문자는 기존 유심을 그대로 두는 경우가 많습니다.',
  },
  {
    tone: 'slate',
    badge: 'QR 1회성',
    question: '설치 후 eSIM을 지워도 되나요?',
    answer:
      '여행이 완전히 끝난 뒤에만 삭제하세요. QR·설치코드는 1회성이라, 지우면 같은 코드로 다시 설치하기 어려운 경우가 많아요. 사용 중 문제가 있으면 삭제하지 말고 고객센터(09:00–18:00 KST)로 문의해 주세요.',
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
      <main>
        <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-28 lg:pt-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700">
            eSIM 설치 가이드
          </p>
          <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl lg:text-[1.75rem]">
            초보도 OK — 짧은 단계로 알려드릴게요
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
            출국 전 준비 · 요금 폭탄 방지 · QR 1회성까지, Bong투어 eSIM을 처음 쓰는 분도 따라 할 수 있게 정리했어요.
            기기별 화면 단계는 전체 설치 가이드에서 확인하세요.
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
              <li>설치는 QR 또는 바로 설치 링크면 끝. 별도 앱 설치는 필요 없어요.</li>
              <li>개통 후에는 기존 유심(통화/문자)을 두고, 데이터만 eSIM으로 쓰는 경우가 많아요.</li>
              <li>QR 인식이 안 되면 이메일·주문 완료 페이지의 SM-DP+·활성화 코드로 수동 설치하세요.</li>
              <li>여행이 끝난 뒤에만 eSIM을 삭제하세요. 삭제 후 같은 QR로 재설치는 어렵습니다.</li>
            </ul>
          </section>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <Link
              href={bongsimPath('/guide')}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50/70 px-5 text-[14px] font-bold text-teal-900 transition hover:bg-teal-100"
            >
              iPhone·Android 전체 가이드
            </Link>
            <Link
              href={bongsimPath('/devices')}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-[14px] font-bold text-slate-800 transition hover:bg-slate-50"
            >
              이용 가능 기기 확인하기
            </Link>
            <Link
              href={bongsimPath()}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-700 px-5 text-[14px] font-bold text-white shadow-md transition hover:bg-teal-800 sm:col-span-2"
            >
              eSIM 다시 둘러보기
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
