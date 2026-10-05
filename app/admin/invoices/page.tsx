import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import OtaInvoiceAdminClient from './OtaInvoiceAdminClient'

export default async function AdminOtaInvoicesPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/invoices')

  return <OtaInvoiceAdminClient />
}
