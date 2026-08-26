import { buildSiteJsonLdGraph } from '@/lib/seo/site-json-ld'

/** 메인: Organization + WebSite + TravelAgency (홈 전용, @graph) */
export default function SiteJsonLd() {
  const data = buildSiteJsonLdGraph()
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
