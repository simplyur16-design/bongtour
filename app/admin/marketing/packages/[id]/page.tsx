import MarketingBlogDetailClient from '../../components/MarketingBlogDetailClient'

export default async function MarketingPackageBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <MarketingBlogDetailClient id={id} expectedTrack="package" listHref="/admin/marketing/packages" />
  )
}
