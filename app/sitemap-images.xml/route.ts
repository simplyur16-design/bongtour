import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return ch
    }
  })
}

function pickImageCaption(p: {
  title: string
  bgImageRehostSearchLabel: string | null
  bgImagePlaceName: string | null
  publicImageHeroSeoLine: string | null
}): string {
  const chain = [
    p.bgImageRehostSearchLabel,
    p.bgImagePlaceName,
    p.publicImageHeroSeoLine,
    p.title,
  ]
  for (const raw of chain) {
    const t = typeof raw === 'string' ? raw.trim() : ''
    if (t) return t
  }
  return (p.title ?? '').trim() || '상품'
}

export async function GET() {
  const origin = getSiteOrigin()
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      bgImageUrl: { not: null },
    },
    select: {
      id: true,
      title: true,
      bgImageUrl: true,
      bgImageRehostSearchLabel: true,
      bgImagePlaceName: true,
      publicImageHeroSeoLine: true,
    },
    take: 5000,
    orderBy: { updatedAt: 'desc' },
  })

  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
  )

  for (const p of products) {
    const imgUrl = (p.bgImageUrl ?? '').trim()
    if (!imgUrl) continue

    const loc = `${origin}/products/${p.id}`
    const title = (p.title ?? '').trim() || '상품'
    const caption = pickImageCaption(p)

    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(loc)}</loc>`)
    lines.push('    <image:image>')
    lines.push(`      <image:loc>${escapeXml(imgUrl)}</image:loc>`)
    lines.push(`      <image:caption>${escapeXml(caption)}</image:caption>`)
    lines.push(`      <image:title>${escapeXml(title)}</image:title>`)
    lines.push('    </image:image>')
    lines.push('  </url>')
  }

  lines.push('</urlset>')

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
