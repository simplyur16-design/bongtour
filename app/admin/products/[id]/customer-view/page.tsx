import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { PRODUCT_DETAIL_PAGE_INCLUDE } from '@/lib/product-detail-page-include'
import { ProductDetailView } from '@/app/products/[id]/product-detail-view'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

/**
 * Admin-only full customer preview (any registrationStatus).
 * Middleware ensures an authenticated admin panel session before this runs.
 */
export default async function AdminProductCustomerViewPage({ params }: Props) {
  const { id: rawId } = await params
  const session = await requireAdmin()
  if (!session) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/admin/products/${rawId}/customer-view`)}`)
  }

  const id = rawId
  if (typeof id !== 'string' || !id.trim()) {
    notFound()
  }

  const travelProduct = await prisma.product.findFirst({
    where: { id },
    include: PRODUCT_DETAIL_PAGE_INCLUDE,
  })
  if (!travelProduct) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-bt-surface">
      <div className="border-b border-cyan-600 bg-cyan-950 px-4 py-2 text-center text-sm font-medium text-cyan-50">
        Admin customer preview (includes drafts) ·{' '}
        <a href={`/admin/products/${id}`} className="underline">
          Back to product admin
        </a>
      </div>
      <ProductDetailView travelProduct={travelProduct} />
    </div>
  )
}
