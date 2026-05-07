import MarketingBlogDetailClient from '../../components/MarketingBlogDetailClient'

export default async function MarketingAirtelBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <MarketingBlogDetailClient id={id} expectedTrack="airtel" listHref="/admin/marketing/airtel" />
  )
}
