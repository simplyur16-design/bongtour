import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '이용약관',
  description:
    '봉투어 웹사이트 및 여행·연수·우리여행 관련 서비스 이용에 관한 약관, 서비스 유형별 지위, 예약·환불, 책임 범위 안내입니다.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: `이용약관 | ${SITE_NAME}`,
    description:
      '서비스 내용, 상담연결형·직접운영형 서비스, 회원·이용자 의무, 요금·취소·환불, 책임, 분쟁 관할 안내.',
    url: '/terms',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className={`${SITE_CONTENT_CLASS} py-8 sm:py-12`}>
        <article className="mx-auto max-w-3xl [word-break:keep-all]">
          <header className="border-b border-bt-border pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">법적 고지</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">이용약관</h1>
          </header>

          <div className="mt-8 space-y-6 text-[15px] leading-[1.75] text-slate-800">
            <section className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-slate-900">제1조 (목적)</h2>
              <p>
                이 약관은 봉투어(이하 &quot;회사&quot;)가 운영하는 웹사이트 및 관련 서비스에서 제공하는 여행상품 정보
                제공, 상담 신청, 예약 연계, 국외연수 운영, 우리여행 관련 서비스의 이용과 관련하여 회사와 이용자 간의 권리,
                의무 및 책임사항을 정함을 목적으로 합니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제2조 (정의)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  <span className="font-medium text-slate-900">①</span> &quot;사이트&quot;란 회사가 운영하는 웹사이트 및 이를
                  통하여 제공하는 제반 온라인 서비스를 말합니다.
                </li>
                <li>
                  <span className="font-medium text-slate-900">②</span> &quot;이용자&quot;란 사이트에 접속하여 이 약관에 따라
                  회사가 제공하는 서비스를 이용하는 자를 말합니다.
                </li>
                <li>
                  <span className="font-medium text-slate-900">③</span> &quot;여행상품&quot;이란 국내외 여행, 우리여행, 항공,
                  숙박, 투어, 행사, 연수 기타 이에 부수하는 상품 또는 서비스를 말합니다.
                </li>
                <li>
                  <span className="font-medium text-slate-900">④</span> &quot;상담연결형 서비스&quot;란 회사가 여행상품 정보를
                  제공하고 이용자의 상담 신청을 접수하여, 실제 예약 또는 계약이 외부 여행사, 항공사, 랜드사, 연수기관, 행사
                  관련 기관 등과 연결되는 형태의 서비스를 말합니다.
                </li>
                <li>
                  <span className="font-medium text-slate-900">⑤</span> &quot;직접운영형 서비스&quot;란 회사가 직접 주최,
                  주관, 모집, 진행 또는 계약 당사자로서 제공하는 서비스로서, 현재 회사의 국외연수 서비스가 이에 해당할 수
                  있습니다.
                </li>
                <li>
                  <span className="font-medium text-slate-900">⑥</span> &quot;혼합형 서비스&quot;란 상품 또는 서비스 유형에
                  따라 회사가 통신판매업자로서 직접 계약 당사자가 되거나, 통신판매중개업자로서 예약·상담을 연결하는 방식을
                  병행하는 서비스를 말합니다.
                </li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제3조 (회사 정보의 표시)</h2>
              <p>회사는 관련 법령에 따라 다음 정보를 사이트에 표시합니다.</p>
              <ul className="ml-4 list-none space-y-1 pl-0 text-slate-800">
                <li>상호: 봉투어</li>
                <li>대표자: 황일연</li>
                <li>사업자등록번호: 255-81-03455</li>
                <li>통신판매업 신고번호: 제 2024-수원영통-1596호</li>
                <li>주소: 경기도 수원시 영통구 에듀타운로 101 에듀하임 103동 110호</li>
                <li>
                  전화:{' '}
                  <a href="tel:0312132558" className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover">
                    031-213-2558
                  </a>
                </li>
                <li>팩스: 031-215-2558</li>
                <li>
                  이메일:{' '}
                  <a
                    href="mailto:bongtour24@naver.com"
                    className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover"
                  >
                    bongtour24@naver.com
                  </a>
                </li>
              </ul>
              <p>
                전자상거래 관련 법령에 따라 사이버몰 운영자는 신원정보와 이용약관을 초기화면 또는 연결화면에 표시해야 하며,
                통신판매중개업자는 자신이 판매의 당사자인지 여부를 소비자가 쉽게 알 수 있도록 고지합니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제4조 (약관의 게시와 개정)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>① 회사는 이 약관의 내용을 이용자가 쉽게 확인할 수 있도록 사이트에 게시합니다.</li>
                <li>② 회사는 관련 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
                <li>
                  ③ 회사가 약관을 개정하는 경우에는 적용일자 및 개정사유를 명시하여 적용일자 상당 기간 전부터 사이트에
                  공지합니다.
                </li>
                <li>
                  ④ 이용자가 개정약관 시행일까지 명시적으로 거부의사를 표시하지 않고 계속 서비스를 이용하는 경우,
                  개정약관에 동의한 것으로 볼 수 있습니다. 다만 이용자에게 불리한 변경의 경우에는 관련 법령 및 일반적인
                  거래관행에 따라 보다 명확하게 고지합니다.
                </li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제5조 (서비스의 내용)</h2>
              <p>회사는 다음 서비스를 제공합니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1">
                <li>여행상품 정보 제공</li>
                <li>상담 신청 접수 및 문의 응대</li>
                <li>여행상품 예약 상담 및 공급사 연계</li>
                <li>우리여행 관련 맞춤 상담 및 예약 진행 보조</li>
                <li>국외연수, 행사, 기관 연계 프로그램 운영</li>
                <li>기타 회사가 정하는 부가 서비스</li>
              </ul>
              <p>
                회사가 제공하는 개별 서비스는 그 성격에 따라 상담연결형, 직접운영형, 또는 혼합형으로 운영될 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제6조 (서비스 유형별 회사의 지위)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  ① 여행상품 일반 서비스의 경우, 회사는 상품 정보를 제공하고 상담을 연결하는 역할을 수행할 수 있으며, 실제
                  계약은 외부 여행사, 항공사, 숙박업체, 랜드사 또는 기타 공급사와 체결될 수 있습니다.
                </li>
                <li>② 국외연수 서비스의 경우, 회사가 직접 운영 주체 또는 계약 당사자가 될 수 있습니다.</li>
                <li>
                  ③ 우리여행 서비스의 경우, 상품 특성에 따라 회사가 직접 운영 주체가 되거나, 외부 공급사와 연계하는
                  중개·연결 역할을 병행할 수 있습니다.
                </li>
                <li>
                  ④ 이용자는 각 상품 또는 서비스 상세페이지, 상담 과정, 견적서, 별도 안내문 등을 통해 회사가 해당 거래에서
                  직접 당사자인지 또는 중개·연결자인지를 확인해야 합니다.
                </li>
                <li>
                  ⑤ 회사가 통신판매중개업자로서 서비스를 제공하는 경우, 실제 상품 내용, 가격, 예약 가능 여부, 취소 및 환불
                  조건은 해당 공급사 또는 실제 계약 당사자의 기준이 우선 적용될 수 있습니다.
                </li>
              </ol>
              <p>
                통신판매중개업자는 소비자가 판매 당사자를 쉽게 알 수 있도록 고지해야 하며, 중개자라는 이유만으로 회사의
                법령상 책임이 자동으로 면제되는 것은 아닙니다. 약관상 역할 구분은 명확히 하되, 회사의 고의·과실 등
                귀책사유가 있는 경우 관련 법령에 따릅니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제7조 (이용계약의 성립)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>① 이용자는 사이트에서 제공하는 절차에 따라 상담 신청, 문의 접수, 예약 요청 등을 할 수 있습니다.</li>
                <li>② 사이트 이용 자체는 회사가 이를 승낙함으로써 성립합니다.</li>
                <li>
                  ③ 다만 개별 여행상품 또는 연수 프로그램에 대한 실제 계약은 다음 각 호에 따라 별도로 성립합니다.
                  <ul className="mt-2 ml-4 list-disc space-y-1 pl-1">
                    <li>상담연결형 서비스: 외부 공급사 또는 실제 계약 당사자의 승낙 및 예약 확정 시</li>
                    <li>직접운영형 서비스: 회사의 접수 및 확정 통지 시</li>
                    <li>혼합형 서비스: 해당 상품별 안내에 따름</li>
                  </ul>
                </li>
                <li>④ 회사는 상담 신청 또는 예약 요청이 접수되었다는 사정만으로 예약 또는 계약이 확정된 것으로 보지 않습니다.</li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제8조 (회원가입 및 계정)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  ① 사이트는 찜·문의 이력 등 일부 기능을 위해 회원가입(이메일·소셜 등)을 제공할 수 있으며, 여행·연수 상품
                  탐색 등 일부 이용은 로그인 없이도 가능합니다.
                </li>
                <li>② 회원제 운영 정책·절차는 서비스 화면 및 별도 안내에 따릅니다.</li>
                <li>③ 관리자 계정 및 내부 운영 계정은 회사의 별도 관리 기준에 따릅니다.</li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제9조 (이용자의 의무)</h2>
              <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1">
                <li>타인의 정보 도용</li>
                <li>허위 정보 입력</li>
                <li>사이트 운영을 방해하는 행위</li>
                <li>회사 또는 제3자의 권리 침해 행위</li>
                <li>법령 또는 공서양속에 반하는 행위</li>
                <li>상담, 예약 또는 문의 과정에서 실제 의사 없이 반복적으로 요청하는 행위</li>
                <li>회사 또는 공급사의 업무를 현저히 방해하는 행위</li>
              </ul>
              <p>
                이용자가 위 행위를 한 경우 회사는 서비스 이용 제한, 상담 거절, 예약 요청 보류 등의 조치를 할 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제10조 (상품정보 및 예약 가능 여부)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  ① 회사는 사이트에 여행상품, 일정, 가격, 출발일, 포함사항, 불포함사항, 행사정보 등 관련 내용을 게시할 수
                  있습니다.
                </li>
                <li>
                  ② 사이트에 게시된 정보는 작성 시점을 기준으로 하며, 실제 예약 가능 여부, 가격, 좌석 또는 객실 상황, 출발
                  가능 여부, 행사 운영 조건 등에 따라 달라질 수 있습니다.
                </li>
                <li>
                  ③ 상담연결형 서비스의 경우, 최종 조건은 해당 공급사 또는 실제 계약 당사자가 확정하여 안내하는 내용이
                  우선할 수 있습니다.
                </li>
                <li>
                  ④ 회사는 정보 최신성 확보를 위해 노력하나, 외부 공급사의 사정 변경, 항공편 변경, 현지 사정, 환율,
                  유류할증료, 세금, 행사 운영 조건 등에 따라 정보가 수정될 수 있습니다.
                </li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제11조 (요금, 결제 및 계약 조건)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  ① 사이트에 게시된 가격은 참고용이거나 상담 기준 가격일 수 있으며, 실제 확정 가격은 상담 과정 또는 별도
                  견적서, 예약 확정 안내에 따라 달라질 수 있습니다.
                </li>
                <li>② 회사는 서비스 유형에 따라 직접 결제를 받거나, 결제 없이 상담만 연결할 수 있습니다.</li>
                <li>
                  ③ 직접운영형 서비스 또는 일부 혼합형 서비스에서 회사가 결제를 받는 경우, 결제 조건과 세부 금액은 별도
                  고지합니다.
                </li>
                <li>
                  ④ 상담연결형 서비스에서 실제 결제는 외부 공급사 또는 실제 계약 당사자를 통해 진행될 수 있습니다.
                </li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제12조 (취소, 환불 및 변경)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>① 상담 신청 자체는 별도의 대금 지급이 없는 범위에서 자유롭게 철회할 수 있습니다.</li>
                <li>
                  ② 실제 예약 또는 계약이 성립한 이후의 취소, 환불, 변경은 다음 기준에 따릅니다.
                  <ul className="mt-2 ml-4 list-disc space-y-1 pl-1">
                    <li>회사가 직접 당사자인 서비스: 회사가 별도로 고지한 조건</li>
                    <li>
                      외부 공급사와 계약이 성립한 서비스: 해당 공급사, 실제 계약 당사자, 개별 약관, 특별약관 또는 별도 안내
                      기준
                    </li>
                    <li>법령 또는 표준약관이 우선 적용되는 경우: 해당 법령 또는 표준약관</li>
                  </ul>
                </li>
                <li>
                  ③ 국외여행 또는 국내여행 계약이 실제로 성립하는 경우, 공정거래위원회의 국내·국외여행 표준약관이 참조 또는
                  준용될 수 있으며, 상품 특성상 별도 특별약관이 적용될 수 있습니다. 다만 특별약관은 법령 및 표준약관 취지에
                  반하지 않아야 합니다.
                </li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제13조 (회사의 책임과 면책)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  ① 회사는 관련 법령과 이 약관에 위반되지 않는 범위에서 서비스를 안정적으로 제공하기 위하여 노력합니다.
                </li>
                <li>
                  ② 회사는 직접운영형 서비스에 관하여 회사의 고의 또는 과실로 이용자에게 손해가 발생한 경우 관련 법령에 따라
                  책임을 집니다.
                </li>
                <li>
                  ③ 상담연결형 서비스에서 회사가 통신판매중개업자의 지위에 있는 경우, 회사는 거래의 안전성과 신뢰성 확보를
                  위해 합리적인 범위에서 필요한 조치를 취합니다.
                </li>
                <li>
                  ④ 다만 다음 각 호의 사유로 발생한 손해에 대하여 회사는 회사의 귀책사유가 없는 한 책임을 지지 않습니다.
                  <ul className="mt-2 ml-4 list-disc space-y-1 pl-1">
                    <li>천재지변, 전쟁, 감염병 확산, 정부의 명령 또는 이에 준하는 불가항력</li>
                    <li>항공사, 숙박업체, 랜드사, 행사기관 등 제3자의 사유로 인한 변경 또는 취소</li>
                    <li>이용자의 귀책사유로 인한 손해</li>
                    <li>사이트 점검, 통신장애, 시스템 장애 등 불가피한 사유</li>
                  </ul>
                </li>
                <li>⑤ 회사는 통신판매중개업자라는 이유만으로 법령상 또는 회사 귀책에 따른 책임까지 일률적으로 배제하지 않습니다.</li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제14조 (개인정보 보호)</h2>
              <p>
                회사는 이용자의 개인정보를 관련 법령 및 회사의{' '}
                <a href="/privacy" className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover">
                  개인정보처리방침
                </a>
                에 따라 보호합니다. 개인정보의 수집, 이용, 보관, 제3자 제공, 국외 이전 등에 관한 사항은 해당 방침에 따릅니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제15조 (지식재산권)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>
                  ① 사이트에 게시된 문구, 디자인, 편집물, 이미지, 로고, 데이터베이스, 소프트웨어 기타 저작물에 관한 권리는
                  회사 또는 정당한 권리자에게 귀속됩니다.
                </li>
                <li>
                  ② 이용자는 회사의 사전 동의 없이 이를 복제, 배포, 전송, 전시, 변경, 2차적 저작물 작성 등의 방법으로 이용할
                  수 없습니다.
                </li>
                <li>③ 단, 법령상 허용되는 범위의 이용은 예외로 합니다.</li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제16조 (서비스의 중단)</h2>
              <p>회사는 다음 각 호의 사유가 있는 경우 서비스의 전부 또는 일부를 제한하거나 중단할 수 있습니다.</p>
              <ul className="ml-4 list-disc space-y-1 pl-1">
                <li>시스템 점검 또는 유지보수</li>
                <li>통신망 장애</li>
                <li>천재지변 기타 불가항력</li>
                <li>제휴사 또는 공급사 시스템 문제</li>
                <li>기타 회사가 합리적으로 필요하다고 판단하는 경우</li>
              </ul>
              <p>
                회사는 이용자에게 중대한 영향을 미치는 경우 사전에 공지하도록 노력합니다. 다만 긴급한 장애나 불가피한 사유가
                있는 경우 사후 공지할 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제17조 (분쟁처리 및 준거법)</h2>
              <ol className="list-none space-y-2 pl-0">
                <li>① 회사는 이용자의 정당한 의견이나 불만을 반영하고 피해를 구제하기 위해 노력합니다.</li>
                <li>② 회사와 이용자 간 분쟁이 발생한 경우, 당사자는 상호 협의하여 해결하도록 노력합니다.</li>
                <li>③ 이 약관과 관련한 분쟁에는 대한민국 법을 적용합니다.</li>
                <li>④ 관할법원은 관련 법령에 따릅니다.</li>
              </ol>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-2">
              <h2 className="text-lg font-bold text-slate-900">제18조 (약관 외 준칙)</h2>
              <p>
                이 약관에서 정하지 아니한 사항은 관련 법령, 상관례, 개별 서비스 안내, 별도 약정, 표준약관 등에 따릅니다. 실제
                여행계약이 성립한 경우에는 해당 상품 유형에 적용되는 국내여행 표준약관, 국외여행 표준약관 또는 개별 계약조건이
                함께 적용될 수 있습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 border-t border-bt-border pt-4">
              <h2 className="text-lg font-bold text-slate-900">부칙</h2>
              <p>이 약관은 2026년 4월 8일부터 적용합니다.</p>
            </section>
          </div>
        </article>
      </main>
    </div>
  )
}
