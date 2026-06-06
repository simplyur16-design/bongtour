import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import { LEGAL_ENTITY, LEGAL_POLICY_LINKS } from '@/lib/legal-site-disclosures'
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
              {LEGAL_ENTITY.legalName}(이하 &quot;회사&quot;, 서비스명 {LEGAL_ENTITY.serviceName})는 「개인정보 보호법」 등
              관련 법령에 따라 정보주체의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록
              다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>
            <p>
              본 방침은 회사가 운영하는 웹사이트 및 이를 통해 제공되는 <strong>여행상품 상담·견적·예약 접수</strong>,{' '}
              <strong>국외연수·우리끼리(맞춤) 여행</strong>, <strong>회원가입·계정 관리</strong>,{' '}
              <strong>eSIM 구매·발급·고객지원</strong>, 행사·기업 연수 문의 등 전 서비스에 적용됩니다. 회원가입 시 별도
              동의 화면에서 안내하는 항목이 있는 경우, 해당 동의와 본 방침을 함께 적용합니다.
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
              <p className="font-medium text-slate-900">4. 회원가입 및 계정 이용 시</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>이메일, 비밀번호(암호화 저장), 이름·연락처(입력 시)</li>
                <li>소셜 로그인 연동 식별자(네이버·카카오 등 이용 시)</li>
                <li>회원 식별·찜·문의·후기·마이페이지 이용 기록</li>
                <li>접속 로그, IP, 기기·브라우저 정보</li>
              </ul>
              <p className="font-medium text-slate-900">5. eSIM 구매·이용 시</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>주문자·수신자 이메일, 연락처, 결제 관련 정보</li>
                <li>기기 호환 확인·주문·QR 발송·활성화·환불 처리에 필요한 정보</li>
                <li>결제 대행(PG) 처리 과정에서 생성되는 거래 식별 정보</li>
              </ul>
              <p className="font-medium text-slate-900">6. 마케팅 정보 수신에 동의한 경우</p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>이름, 이메일, 연락처</li>
                <li>이벤트·혜택·서비스 안내 발송 및 수신 이력</li>
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
                <li>회원가입·본인 확인·계정·찜·후기 등 회원 서비스 제공</li>
                <li>eSIM 상품 주문·결제·발급·고객지원 및 환불 처리</li>
                <li>마케팅·이벤트·혜택 안내(별도 동의한 경우에 한함)</li>
              </ul>
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
                <li>
                  <span className="font-medium text-slate-900">회원 정보</span> — 회원 탈퇴 시까지. 탈퇴 후에는 아래
                  「회원 탈퇴 시 파기」에 따름
                </li>
                <li>
                  <span className="font-medium text-slate-900">마케팅 수신 동의 정보</span> — 동의일로부터 2년 또는 동의
                  철회·탈퇴 시까지
                </li>
                <li>
                  <span className="font-medium text-slate-900">eSIM 주문·결제 기록</span> — 전자상거래 등 관련 법령에 따른
                  보관 기간
                </li>
              </ol>
              <p className="font-medium text-slate-900">회원 탈퇴 시 파기</p>
              <p>
                이용자가 회원 탈퇴를 요청하거나 회사가 탈퇴 절차를 완료한 경우, 회사는 지체 없이 해당 회원의 식별·인증
                정보, 소셜 연동 정보, 찜·후기 등 회원 전용 서비스 데이터를 삭제·파기합니다. 다만 다음은 관련 법령·분쟁
                대응·이전 상담·예약·결제 이력과 분리 보관이 필요한 범위에서 최소한으로 보관할 수 있으며, 보관 시
                개인정보와 분리하거나 가명·암호화 등 안전조치를 적용합니다.
              </p>
              <ul className="ml-4 list-disc space-y-1 pl-1 text-slate-800">
                <li>전자상거래법 등에 따른 계약·결제·환불 기록</li>
                <li>이미 접수된 여행 상담·예약 진행 건에 필요한 연락 정보</li>
                <li>법령상 의무 보존 대상 로그·거래 기록</li>
              </ul>
              <p>
                회사는 보유기간 경과, 처리 목적 달성 등 개인정보가 불필요하게 된 경우 지체 없이 해당 개인정보를
                파기합니다.
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
              <p>
                회사는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리 업무를 외부에 위탁할 수 있습니다. 위탁
                시 관련 법령에 따라 계약서 등에 안전조치·재위탁 제한·파기 등 필요한 사항을 명시하고 관리·감독합니다.
              </p>
              <ul className="ml-4 list-disc space-y-2 pl-1 text-slate-800">
                <li>
                  <span className="font-medium text-slate-900">클라우드·DB 호스팅</span> — 웹사이트·데이터베이스 운영·
                  백업(개인정보 저장·처리)
                </li>
                <li>
                  <span className="font-medium text-slate-900">이메일·알림 발송</span> — 상담·예약·eSIM·마케팅 등 안내
                  메일 발송(SMTP 등)
                </li>
                <li>
                  <span className="font-medium text-slate-900">소셜 로그인</span> — 네이버·카카오 등 OAuth 연동 시 해당
                  사업자의 인증 처리
                </li>
                <li>
                  <span className="font-medium text-slate-900">전자결제 대행(PG)</span> — eSIM 등 온라인 결제 처리(결제
                  승인·취소 등)
                </li>
                <li>
                  <span className="font-medium text-slate-900">eSIM 발급·운영 연계</span> — 디지털 상품 주문·QR 발송·
                  고객지원 연계
                </li>
              </ul>
              <p>수탁자·위탁 범위가 변경되는 경우 본 방침을 개정하여 공지합니다.</p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제6조 (개인정보의 국외 이전)</h2>
              <p>
                회사는 해외여행 상품 상담 및 예약 진행 과정에서 해외 항공사, 해외 숙박업체, 국외 랜드사, 해외 예약
                시스템 등을 이용할 수 있으며, 이 경우 개인정보가 국외로 이전될 수 있습니다. 여행업은 실제 업무 특성상
                국외 이전이 발생할 가능성이 높아, 여행사 표준안에서도 해당 항목을 실제 처리 현황에 맞게 구체적으로 기재하도록
                안내하고 있습니다.
              </p>
              <p className="font-medium text-slate-900">1. 국외 이전이 발생할 수 있는 경우</p>
              <p>
                해외 항공사, 숙박업체, 국외 랜드사, 해외 예약·발권 시스템, eSIM 현지 통신·플랫폼 연계 등 여행·eSIM 서비스
                제공 과정에서 국외로 이전될 수 있습니다.
              </p>
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
              <h2 className="text-lg font-bold text-slate-900">제10조 (만 14세 미만 아동)</h2>
              <p>
                회사는 원칙적으로 만 14세 미만 아동의 회원가입을 제한합니다. 만 14세 미만 아동의 개인정보를 법정대리인
                동의 없이 수집한 사실을 인지한 경우 지체 없이 삭제 등 필요한 조치를 합니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제11조 (마케팅 정보 수신 동의)</h2>
              <p>
                이메일·문자·카카오 등 마케팅 안내는 <strong>별도 동의</strong>를 받은 경우에만 발송합니다. 동의하지
                않아도 회원가입·여행 상담·eSIM 구매 등 필수 서비스 이용에는 제한이 없습니다.
              </p>
              <p>
                마케팅 동의 철회·탈퇴 시 관련 발송을 중단하고, 보유 기간(동의일로부터 2년 또는 철회·탈퇴 시까지) 경과
                후 파기합니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제12조 (쿠키의 설치·운영 및 거부)</h2>
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
              <h2 className="text-lg font-bold text-slate-900">제13조 (개인정보 보호책임자)</h2>
              <p>
                회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및
                피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정합니다.
              </p>
              <ul className="ml-4 list-none space-y-1 pl-0 text-slate-800">
                <li>
                  <span className="font-medium text-slate-900">성명:</span> {LEGAL_ENTITY.representativeName}
                </li>
                <li>
                  <span className="font-medium text-slate-900">이메일:</span>{' '}
                  <a href={LEGAL_ENTITY.emailHref} className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover">
                    {LEGAL_ENTITY.email}
                  </a>
                </li>
                <li>
                  <span className="font-medium text-slate-900">전화번호:</span>{' '}
                  <a href={LEGAL_ENTITY.phoneTel} className="text-bt-link underline underline-offset-2 hover:text-bt-link-hover">
                    {LEGAL_ENTITY.phone}
                  </a>
                </li>
              </ul>
              <p>
                정보주체는 회사의 서비스를 이용하면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한
                사항을 개인정보 보호책임자에게 문의할 수 있으며, 회사는 이에 대해 지체 없이 답변 및 처리하겠습니다.
              </p>
            </section>

            <section className="scroll-mt-24 space-y-3 pt-4">
              <h2 className="text-lg font-bold text-slate-900">제14조 (권익침해 구제방법)</h2>
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
              <h2 className="text-lg font-bold text-slate-900">제15조 (개인정보처리방침의 변경)</h2>
              <p>이 개인정보처리방침은 {LEGAL_ENTITY.policyEffectiveDate}부터 적용되며, {LEGAL_ENTITY.policyRevisedDate}에 일부 개정되었습니다.</p>
              <p>
                회사는 법령, 서비스(여행·eSIM·회원 등) 또는 내부 운영정책 변경에 따라 본 방침을 수정할 수 있으며, 중요
                변경 시 시행일·개정 사유를 웹사이트에 공지합니다. eSIM 환불·이용 조건은{' '}
                <a href={LEGAL_POLICY_LINKS.esimPolicy} className="text-bt-link underline underline-offset-2">
                  eSIM 환불·서비스 정책
                </a>
                을 함께 확인해 주세요.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  )
}
