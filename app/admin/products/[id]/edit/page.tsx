'use client'

import AdminProductDetailPage from '../page'

export default function AdminProductEditPage(props: { params: Promise<{ id: string }> }) {
  return <AdminProductDetailPage params={props.params} />
}
