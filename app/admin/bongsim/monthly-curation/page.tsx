import OverseasContentAdminClient from '@/app/admin/overseas-content/OverseasContentAdminClient'
import MonthlyCurationGenerateClient from './MonthlyCurationGenerateClient'

export default function AdminMonthlyCurationGeneratePage() {
  return (
    <div className="space-y-10">
      <MonthlyCurationGenerateClient />
      <OverseasContentAdminClient view="monthly" />
    </div>
  )
}
