export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { listTrainingProgramsAdmin } from '@/lib/overseas-training-admin'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_BTN_PRIMARY_CLASS, ADMIN_BTN_SECONDARY_CLASS } from '@/lib/admin-design-system'
import { trainingProgramPublicPath } from '@/lib/overseas-training-program-query'
import {
  TRAINING_AUDIENCE_LABELS,
  TRAINING_CATEGORY_LABELS,
  parseTrainingAudience,
  parseTrainingCategory,
} from '@/lib/overseas-training-taxonomy'
import { formatTrainingProgramMetaLine } from '@/lib/overseas-training-weekday'

export default async function AdminTrainingProgramsPage() {
  const programs = await listTrainingProgramsAdmin()

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="국외연수 프로그램"
        subtitle="공개: /business/programs — 6공급사 등록과 별도"
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/admin/training-programs/new" className={ADMIN_BTN_PRIMARY_CLASS}>
          프로그램 등록
        </Link>
        <Link href="/admin/training-programs/guide" className={ADMIN_BTN_SECONDARY_CLASS}>
          운영 가이드
        </Link>
        <Link href="/business/programs" className={ADMIN_BTN_SECONDARY_CLASS} target="_blank">
          공개 목록
        </Link>
      </div>

      {programs.length === 0 ? (
        <p className="text-slate-600">등록된 프로그램이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">분야</th>
                <th className="px-4 py-3">대상</th>
                <th className="px-4 py-3">메타</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const cat = parseTrainingCategory(p.trainingCategory)
                const aud = parseTrainingAudience(p.trainingAudience)
                const meta = formatTrainingProgramMetaLine(p.durationDays, p.fixedDepartureWeekday)
                const pub =
                  p.registrationStatus === 'registered'
                    ? trainingProgramPublicPath({ id: p.id, slug: p.slug })
                    : null
                return (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                    <td className="px-4 py-3 text-slate-600">{cat ? TRAINING_CATEGORY_LABELS[cat] : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{aud ? TRAINING_AUDIENCE_LABELS[aud] : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{meta || '-'}</td>
                    <td className="px-4 py-3">{p.registrationStatus}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/training-programs/${p.id}`} className="text-bt-link hover:underline">
                        편집
                      </Link>
                      {pub ? (
                        <>
                          {' · '}
                          <a href={pub} target="_blank" rel="noopener noreferrer" className="text-bt-link hover:underline">
                            공개
                          </a>
                        </>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
