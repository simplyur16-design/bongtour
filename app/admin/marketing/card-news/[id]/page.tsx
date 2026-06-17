import CardNewsDetailClient from '@/components/admin/marketing/card-news/CardNewsDetailClient'

export const dynamic = 'force-dynamic'

export default async function CardNewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CardNewsDetailClient seriesId={id} />
}
