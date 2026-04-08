import { absoluteUrl, SITE_NAME, toAbsoluteImageUrl } from '@/lib/site-metadata'

type Props = {
  productId: string
  name: string
  description: string
  imageUrl: string | null | undefined
}

/** 상품 상세: 실제 노출 정보 기준 최소 Product 스키마 (가격·재고 등 불확실 필드 제외) */
export default function ProductJsonLd({ productId, name, description, imageUrl }: Props) {
  const url = absoluteUrl(`/products/${productId}`)
  const img = toAbsoluteImageUrl(imageUrl)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url,
    ...(img ? { image: [img] } : {}),
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
