import { buildSiteJsonLdGraph } from '@/lib/seo/site-json-ld'
import { jsonLdScriptHtml } from '@/lib/seo/training-json-ld'

/** 메인: Organization + WebSite + TravelAgency (홈 전용, @graph) */
// REGRESSION-FREEZE[public-jsonld-script-escape]: JSON-LD script 종료 탈출 — manifest
export default function SiteJsonLd() {
  const data = buildSiteJsonLdGraph()
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScriptHtml(data) }}
    />
  )
}
