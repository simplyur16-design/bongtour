import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import InquiryDetailClient from './InquiryDetailClient'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminInquiryDetailPage({ params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin) {
    redirect('/auth/signin')
  }

  const { id } = await params
  if (!id?.trim()) {
    redirect('/admin/inquiries')
  }

  return <InquiryDetailClient inquiryId={id.trim()} />
}
