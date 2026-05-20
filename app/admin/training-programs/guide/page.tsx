import Link from 'next/link'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import {
  TRAINING_AUDIENCE_LABELS,
  TRAINING_CATEGORY_LABELS,
  TRAINING_CATEGORY_VALUES,
  TRAINING_AUDIENCE_VALUES,
} from '@/lib/overseas-training-taxonomy'
import { ADMIN_BTN_SECONDARY_CLASS } from '@/lib/admin-design-system'

const CHECKLIST = [
  '윈저 URL·본문 paste → 3블록 분할 검수',
  '봉투어 노출 제목 제안·수동 확정 (축약 금지)',
  '출발 요일·일수·분야·대상 입력',
  'Gemini 대표 이미지 생성 또는 URL 입력',
  'registrationStatus = registered 로 게시',
  '공개 URL /business/programs/[slug] 확인',
  '상세에서 「이 프로그램 문의」 프리필 확인',
]

export default function TrainingProgramsGuidePage() {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <AdminPageHeader
        title="국외연수 프로그램 운영 가이드"
        subtitle="in-app SSOT — repo: docs/ops/overseas-training-admin-stack.md"
      />
      <div className="mb-6">
        <Link href="/admin/training-programs" className={ADMIN_BTN_SECONDARY_CLASS}>
          프로그램 목록
        </Link>
      </div>

      <section className="prose prose-slate max-w-none space-y-8">
        <div>
          <h2 className="text-xl font-semibold">공개 URL</h2>
          <ul className="list-disc pl-5 text-slate-700">
            <li>
              허브: <Link href="/business">/business</Link>
            </li>
            <li>
              목록: <Link href="/business/programs">/business/programs</Link>
            </li>
            <li>상세: /business/programs/[slug]</li>
            <li>일반 /products 목록·가격 필터에는 노출하지 않음</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold">등록 절차</h2>
          <ol className="list-decimal pl-5 text-slate-700 space-y-2">
            <li>
              <Link href="/admin/training-programs/new">프로그램 등록</Link>에서 윈저 본문 붙여넣기 → 「3블록으로
              분할」
            </li>
            <li>상품설명·상세일정 JSON·여행준비 JSON 검수</li>
            <li>「제목 제안」으로 봉투어 스타일 제목 적용 (항공사·판촉 문구 제거)</li>
            <li>출발 요일만 공개 메타에 사용 (예: 화요일 출발). 매주/매월/매년 문구 사용 금지</li>
            <li>Gemini 이미지 — profile overseas_training, promptOverride 선택 입력</li>
            <li>게시 상태 → registered</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-semibold">필드 사전</h2>
          <dl className="grid gap-2 text-sm text-slate-700">
            <dt className="font-semibold">title</dt>
            <dd>봉투어 노출명 (히어로 축약 없음)</dd>
            <dt className="font-semibold">originalTitle</dt>
            <dd>윈저 원문 보관</dd>
            <dt className="font-semibold">trainingDescription</dt>
            <dd>상품설명 탭</dd>
            <dt className="font-semibold">schedule</dt>
            <dd>상세일정 JSON</dd>
            <dt className="font-semibold">prepChecklistJson</dt>
            <dd>여행준비·체크 JSON</dd>
            <dt className="font-semibold">fixedDepartureWeekday / durationDays</dt>
            <dd>0=일 … 6=토, 프로그램 일수</dd>
            <dt className="font-semibold">priceFrom / ProductDeparture</dt>
            <dd>사용 안 함 (가격 비공개)</dd>
          </dl>
        </div>

        <div>
          <h2 className="text-xl font-semibold">분야 taxonomy</h2>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {TRAINING_CATEGORY_VALUES.map((c) => (
              <li key={c}>
                {c}: {TRAINING_CATEGORY_LABELS[c]}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold">대상 audience</h2>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {TRAINING_AUDIENCE_VALUES.map((a) => (
              <li key={a}>
                {a}: {TRAINING_AUDIENCE_LABELS[a]}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold">문의 연동</h2>
          <p className="text-slate-700">
            상세 CTA → TrainingInquiryForm, inquiryType overseas_training_quote, productId·프로그램명 스냅샷.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold">게시 전 체크리스트</h2>
          <ul className="space-y-2">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex gap-2 text-slate-800">
                <span className="text-emerald-700">☐</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold">FAQ</h2>
          <p className="text-slate-700">
            <strong>프로그램 0건:</strong> /business에 「준비 중」만 표시 — registered 프로그램 1건 이상 필요.
          </p>
          <p className="text-slate-700">
            <strong>이미지 실패:</strong> GEMINI_API_KEY, Supabase Storage, promptOverride 단순화.
          </p>
          <p className="text-slate-700">
            <strong>slug:</strong> 저장 시 자동 otr-*-#### 부여. 중복 시 재저장.
          </p>
        </div>
      </section>
    </div>
  )
}
