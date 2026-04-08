import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '봉투어의 개인정보 수집·이용 목적, 보유 기간, 제3자 제공, 국외 이전, 권리 행사 등 개인정보 처리에 관한 안내입니다.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: `개인정보처리방침 | ${SITE_NAME}`,
    description:
      '개인정보 수집 항목, 처리 목적, 보유 기간, 제3자 제공, 국외 이전, 파기, 권리 행사 및 보호책임자 안내.',
    url: '/privacy',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className={`${SITE_CONTENT_CLASS} py-8 sm:py-12`}>
        <article className="mx-auto max-w-3xl [word-break:keep-all]">
          <header className="border-b border-bt-border pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">법적 고지</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">개인정보처리방침</h1>
          </header>

          <div className="prose-privacy mt-8 space-y-6 text-[15px] leading-[1.75] text-slate-800 sm:text-[15px]">
            <p>
              봉투어(이하 &quot;회사&quot;)는 「개인정보 보호법」 등 관련 법령에 따라 정보주체의 개인정보를 보호하고, 이와
              관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>
            <p>
              본 개인정보처리방침은 회사가 운영하는 웹사이트 및 이를 통해 제공되는 여행상품 상담, 견적 문의, 예약 신청
              접수, 행사 및 연수 관련 문의 서비스에 적용됩니다. 회사는 실제 업무 흐름과 개인정보 처리 특성에 맞추어 처리
              목적, 수집 항목, 보유 기간, 제3자 제공, 국외 이전, 권리행사 절차 등을 구체적으로 안내합니다.
            </p>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제1조 (수집하는 개인정보 항목)</h2>
              <p>회사는 서비스 제공에 필요한 최소한의 개인정보를 수집합니다.</p>
              <p className="font-medium text-slate-900">1. 상담 신청 및 문의 접수 시</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>성명</li>
                <li>연락처</li>
                <li>이메일</li>
                <li>문의 내용</li>
                <li>희망 여행지역</li>
                <li>출발희망일</li>
                <li>인원수</li>
                <li>기타 상담 진행에 필요한 정보</li>
              </ul>
              <p className="font-medium text-slate-900">2. 예약 신청 또는 상품 진행 상담 시</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>예약자명</li>
                <li>연락처</li>
                <li>이메일</li>
                <li>여행자 정보(성명, 생년월일 등 실제 예약 진행에 필요한 범위의 정보)</li>
                <li>여권정보, 영문명, 비자 관련 정보 등 해외여행 진행에 필요한 정보</li>
              </ul>
              <p>
                위 항목은 실제 예약, 발권, 숙박예약, 보험가입, 연수 진행, 행사 운영 등에 필요한 경우에 한하여 추가로
                수집합니다. 개인정보 처리방침은 실제 처리 현황에 맞추어 작성·공개해야 하므로, 회사는 현재 운영 구조에
                필요한 범위 내에서만 개인정보를 수집합니다.
              </p>
              <p className="font-medium text-slate-900">3. 서비스 이용 과정에서 자동으로 생성·수집되는 정보</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>IP 주소</li>
                <li>쿠키</li>
                <li>접속 일시</li>
                <li>서비스 이용 기록</li>
                <li>브라우저 및 기기 정보</li>
                <li>방문 페이지 및 클릭 기록 등 웹사이트 이용 로그</li>
              </ul>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제2조 (개인정보의 처리 목적)</h2>
              <p>회사는 수집한 개인정보를 다음 목적 범위 내에서 처리합니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>여행상품 상담 및 문의 응대</li>
                <li>견적 제공 및 맞춤형 여행상품 안내</li>
                <li>예약 신청 접수 및 본인 확인</li>
                <li>여행 진행 관련 일정 안내 및 상품 설명</li>
                <li>국내외 여행사, 랜드사, 연수기관, 행사 관련 기관과의 연계 진행</li>
                <li>항공, 숙박, 투어, 행사, 보험, 연수 운영 등 예약 및 진행 절차 수행</li>
                <li>이메일, 카카오톡, 문자 등을 통한 안내 및 연락</li>
                <li>고객 요청사항 처리 및 민원 응대</li>
                <li>서비스 개선, 접속 통계 분석, 부정 이용 방지</li>
                <li>법령상 의무 이행 및 분쟁 대응</li>
              </ul>
              <p>
                개인정보 처리 목적은 정보주체가 자신의 정보가 왜 수집·이용되는지 명확히 이해할 수 있도록 구체적으로
                작성하는 것이 요구됩니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제3조 (개인정보의 처리 및 보유 기간)</h2>
              <p>
                회사는 개인정보 수집 시 동의받은 보유·이용 기간 또는 관련 법령에서 정한 기간 내에서 개인정보를
                처리·보유합니다.
              </p>
              <ol className="ml-4 list-decimal space-y-2 pl-1 text-slate-800">
                <li>
                  <span className="font-medium text-slate-900">상담 및 문의 정보</span> — 수집일로부터 2년 또는 정보주체의
                  삭제 요청 시까지
                </li>
                <li>
                  <span className="font-medium text-slate-900">예약 진행 정보</span> — 예약 상담 종료 또는 여행 종료 후
                  관련 법령 및 내부 기준에 따라 필요한 기간 동안 보관
                </li>
                <li>
                  <span className="font-medium text-slate-900">접속기록 및 서비스 이용기록</span> — 관련 법령 및 보안
                  운영상 필요한 기간 동안 보관
                </li>
              </ol>
              <p>
                회사는 보유기간 경과, 처리 목적 달성 등 개인정보가 불필요하게 된 경우 지체 없이 해당 개인정보를
                파기합니다. 개인정보 처리방침은 보유기간을 실제 처리 목적과 법령상 의무에 맞게 정해야 하며, 불필요하게
                장기 보관하는 방식은 지양하는 것이 원칙입니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제4조 (개인정보의 제3자 제공)</h2>
              <p>
                회사는 원칙적으로 정보주체의 개인정보를 제2조의 처리 목적 범위 내에서만 처리하며, 정보주체의 동의 없이
                제3자에게 제공하지 않습니다. 다만 다음의 경우에는 예외로 합니다.
              </p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>정보주체가 사전에 동의한 경우</li>
                <li>법령에 특별한 규정이 있는 경우</li>
                <li>법령상 의무 준수를 위하여 불가피한 경우</li>
                <li>
                  정보주체와의 계약 체결 또는 이행을 위하여 필요한 경우로서 관련 법령이 허용하는 경우
                </li>
              </ul>
              <p>회사는 여행 상담, 예약 진행, 행사 운영을 위해 필요한 경우 다음과 같은 제3자에게 개인정보를 제공할 수 있습니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>하나투어</li>
                <li>모두투어</li>
                <li>참좋은여행</li>
                <li>노랑풍선 등 국내 여행사</li>
                <li>국외 랜드사</li>
                <li>연수기관 및 행사 관련 기관</li>
                <li>해외 항공사</li>
                <li>숙박업체</li>
                <li>여행자보험사 등</li>
              </ul>
              <p>
                제공 항목, 제공 목적, 제공받는 자, 보유 및 이용 기간은 실제 예약 또는 행사 진행 단계에서 서비스 내용에
                따라 별도로 안내하거나 필요한 경우 별도 동의를 받습니다. 위탁 처리와 달리 제3자에게 이전되어 해당
                제3자의 처리 목적 범위 내에서 이용되는 경우에는 관련 법령에 따라 정보주체의 동의 등 적법한 근거가
                필요할 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제5조 (개인정보 처리의 위탁)</h2>
              <p>회사는 원활한 서비스 제공을 위하여 일부 업무를 외부 업체에 위탁할 수 있습니다.</p>
              <p className="font-medium text-slate-900">현재 또는 향후 위탁·연계될 수 있는 업무 예시</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>이메일 발송</li>
                <li>카카오톡 발송</li>
                <li>문자 발송</li>
                <li>시스템 운영 및 유지관리</li>
                <li>고객 문의 관리 및 안내 발송</li>
                <li>웹사이트 운영, 로그 분석 및 보안 관리</li>
              </ul>
              <p>
                회사는 위탁계약 체결 시 관련 법령에 따라 개인정보가 안전하게 처리되도록 필요한 사항을 계약서 등에
                명시하고, 수탁자에 대한 관리·감독을 수행합니다. 위탁 업체가 확정되는 경우 수탁자 명칭·위탁 업무 범위
                등을 본 방침에 반영하거나 별도로 안내할 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제6조 (개인정보의 국외 이전)</h2>
              <p>
                회사는 해외여행 상품 상담 및 예약 진행 과정에서 해외 항공사, 해외 숙박업체, 국외 랜드사, 해외 예약
                시스템 등을 이용할 수 있으며, 이 경우 개인정보가 국외로 이전될 수 있습니다. 여행업은 실제 업무 특성상
                국외 이전이 발생할 가능성이 높아, 여행사 표준안에서도 해당 항목을 실제 처리 현황에 맞게 구체적으로 기재하도록
                안내하고 있습니다.
              </p>
              <p className="font-medium text-slate-900">1. 국외 이전 대상</p>
              <p>실제로 이용되는 해외 항공사</p>
              <p className="font-medium text-slate-900">2. 국외 이전 항목</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>성명</li>
                <li>연락처</li>
                <li>이메일</li>
                <li>생년월일</li>
                <li>여권정보</li>
                <li>영문명</li>
                <li>기타 예약 진행에 필요한 정보</li>
              </ul>
              <p className="font-medium text-slate-900">3. 국외 이전 목적</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>항공권 발권</li>
                <li>해외 서비스 제공 및 예약 확인</li>
                <li>여행 진행에 필요한 예약 및 운영 절차 수행</li>
              </ul>
              <p className="font-medium text-slate-900">4. 보유 및 이용 기간</p>
              <p>예약 및 서비스 제공 완료 시까지 또는 관련 법령상 보관 기간까지</p>
              <p>
                회사는 실제 국외 이전이 발생하는 경우 이전 국가, 이전받는 자, 이전 항목, 이전 일시 및 방법, 보유기간 등을
                사전 안내하거나, 법령상 필요한 경우 별도 동의를 받습니다. 개인정보보호위원회는 개인정보의 국외 이전이
                수반되는 서비스 제공 시 정보주체에게 국외 이전 사실을 처리방침 등으로 반드시 알려야 하며, 별도 동의 또는
                계약 이행에 필요한 처리위탁·보관 등 적법 요건을 준수해야 한다고 안내하고 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제7조 (개인정보의 파기 절차 및 방법)</h2>
              <p>
                회사는 개인정보 보유기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당
                개인정보를 파기합니다.
              </p>
              <p className="font-medium text-slate-900">1. 파기 절차</p>
              <p>
                보유기간이 경과하거나 처리 목적이 달성된 개인정보는 내부 방침 및 관련 법령에 따라 일정 기간 저장 후
                파기합니다.
              </p>
              <p className="font-medium text-slate-900">2. 파기 방법</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>전자적 파일 형태: 복구 또는 재생이 불가능한 방법으로 영구 삭제</li>
                <li>종이 문서 형태: 분쇄 또는 소각</li>
              </ul>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제8조 (정보주체의 권리·의무 및 행사방법)</h2>
              <p>정보주체는 회사에 대해 언제든지 다음 권리를 행사할 수 있습니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>개인정보 열람 요구</li>
                <li>개인정보 정정 요구</li>
                <li>개인정보 삭제 요구</li>
                <li>개인정보 처리정지 요구</li>
                <li>동의 철회 요구</li>
              </ul>
              <p>
                권리 행사는 회사에 서면, 이메일, 전화 등의 방법으로 요청할 수 있으며, 회사는 관련 법령에 따라 지체 없이
                조치하겠습니다. 법정대리인이나 위임을 받은 자를 통한 권리행사도 가능하며, 필요한 경우 관련 서류 제출을
                요청할 수 있습니다. 개인정보보호위원회는 개인정보 보호법 시행령에 따라 서면, 전자우편, 모사전송 등의
                방식으로 권리행사가 가능하다고 안내하고 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제9조 (개인정보의 안전성 확보조치)</h2>
              <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>개인정보 접근 권한의 최소화</li>
                <li>관리자 계정 및 접근권한 관리</li>
                <li>개인정보 처리 시스템 접근기록의 보관 및 점검</li>
                <li>보안 프로그램 설치 및 운영</li>
                <li>서버 및 데이터베이스 보안 관리</li>
                <li>전송 구간 암호화(SSL/TLS 등)</li>
                <li>개인정보 취급자에 대한 관리 및 교육</li>
              </ul>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제10조 (쿠키의 설치·운영 및 거부)</h2>
              <p>회사는 이용자에게 보다 편리한 서비스 제공을 위하여 쿠키를 사용할 수 있습니다.</p>
              <p className="font-medium text-slate-900">1. 쿠키 사용 목적</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>방문 이력 및 이용 형태 분석</li>
                <li>사이트 개선 및 사용자 편의 향상</li>
                <li>서비스 이용 상태 유지</li>
                <li>맞춤형 정보 제공</li>
              </ul>
              <p className="font-medium text-slate-900">2. 쿠키 거부 방법</p>
              <p>
                이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다. 다만 쿠키 저장을 거부할 경우 일부 서비스
                이용에 제한이 있을 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제11조 (개인정보 보호책임자)</h2>
              <p>
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및
                피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정합니다.
              </p>
              <ul className="ml-4 list-none space-y-1 pl-0 text-slate-800">
                <li>
                  <span className="font-medium text-slate-900">성명:</span> 황일연
                </li>
                <li>
                  <span className="font-medium text-slate-900">이메일:</span>{' '}
                  <a href="mailto:bongtour24@naver.com" className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover">
                    bongtour24@naver.com
                  </a>
                </li>
                <li>
                  <span className="font-medium text-slate-900">전화번호:</span>{' '}
                  <a href="tel:0312132558" className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover">
                    031-213-2558
                  </a>
                </li>
              </ul>
              <p>
                정보주체는 회사의 서비스를 이용하면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한
                사항을 개인정보 보호책임자에게 문의할 수 있으며, 회사는 이에 대해 지체 없이 답변 및 처리하겠습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제12조 (권익침해 구제방법)</h2>
              <p>정보주체는 개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의할 수 있습니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>개인정보침해신고센터: 국번없이 118</li>
                <li>개인정보분쟁조정위원회: 1833-6972</li>
              </ul>
              <p>
                이들 기관은 회사와는 별개의 기관으로서, 회사 자체적인 개인정보 불만처리 또는 피해구제로 충분하지 않은
                경우 도움을 받을 수 있습니다. 관련 구제기관 안내는 개인정보보호위원회 공식 안내 체계에 따라 확인할 수
                있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 border-t border-bt-border pt-4">
              <h2 className="text-lg font-bold text-slate-900">제13조 (개인정보처리방침의 변경)</h2>
              <p>이 개인정보처리방침은 2026년 4월 8일부터 적용됩니다.</p>
              <p>
                회사는 법령, 서비스 내용 또는 내부 운영정책의 변경에 따라 개인정보처리방침을 수정할 수 있으며, 변경 시
                웹사이트를 통하여 공지하겠습니다.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  )
}
