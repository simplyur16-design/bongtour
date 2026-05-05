'use client'

import AdminProductDetailPage from '../page'

export default function AdminProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  return <AdminProductDetailPage params={params} />
}
