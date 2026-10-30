/**
 * 10/30 review-01 반려 재검색 (읽기 전용: DB select + Pexels search만, 쓰기 없음).
 * REGRESSION-FREEZE[pexels-city-location-filter-1030]
 *
 *   npx tsx scripts/image-batch-city-research.ts --targets targets.json --out out.json [--env .env.local]
 * targets.json: [{ slug, landmarks?: string[], extraCities?: string[] }]
 * 출력: 상품별 도시 매칭어 + 필터 통과 Pexels 후보(최대 3) + 제외 사유 집계. 키·DB URL은 출력하지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { cityLocationVerdict, englishCityTerms, type CityLocationVerdict } from '@/lib/pexels-city-location-filter'

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}
function loadEnvFile(p: string | null) {
  if (!p) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue // --env 파일이 우선 (Prisma가 먼저 읽은 .env 를 덮어씀)
    let v = m[2].trim()
    const q = v[0] === '"' || v[0] === "'" ? v[0] : null
    if (q) v = v.slice(1, v.indexOf(q, 1) > 0 ? v.indexOf(q, 1) : undefined)
    else v = v.replace(/\s+#.*$/, '')
    process.env[m[1]] = v
  }
}

/** cities: 있으면 DB 도시 대신 이 값만 사용(다도시 leaf·국가 단위 city 보정 — 제목의 실제 도시) */
type Target = { slug: string; landmarks?: string[]; extraCities?: string[]; cities?: string[]; excludeIds?: string[] }
type PexelsPhoto = { id: number; width: number; height: number; url: string; alt: string; photographer: string; src: { original: string } }

async function pexelsSearch(q: string, page = 1): Promise<PexelsPhoto[]> {
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=40&page=${page}&orientation=landscape`
  const r = await fetch(u, { headers: { Authorization: process.env.PEXELS_API_KEY ?? '' } })
  if (!r.ok) throw new Error(`pexels ${r.status}`)
  const j = (await r.json()) as { photos?: PexelsPhoto[] }
  return j.photos ?? []
}

function pexelsIdFromUrl(u: string | null | undefined): string | null {
  const m = (u ?? '').match(/pexels[-_](?:photo[-_])?(\d{5,})/i)
  return m ? m[1] : null
}

async function main() {
  loadEnvFile(arg('--env'))
  const targets = JSON.parse(readFileSync(arg('--targets') ?? 'targets.json', 'utf8')) as Target[]
  const prisma = new PrismaClient()
  const rows = await prisma.product.findMany({
    where: { slug: { in: targets.map((t) => t.slug) } },
    select: { id: true, slug: true, title: true, city: true, cityKey: true, nodeKey: true, country: true, primaryDestination: true, destinationRaw: true, bgImageUrl: true, bgImageSource: true, bgImageExternalId: true },
  })
  const used = await prisma.product.findMany({ where: { bgImageUrl: { not: null } }, select: { slug: true, bgImageUrl: true, bgImageExternalId: true, bgImageSource: true } })
  await prisma.$disconnect()
  const usedIds = new Map<string, string>()
  for (const u of used) {
    const id = (u.bgImageSource ?? '').toLowerCase().includes('pexels') && u.bgImageExternalId ? u.bgImageExternalId : pexelsIdFromUrl(u.bgImageUrl)
    if (id) usedIds.set(id, u.slug ?? '')
  }
  const taken = new Set<string>()
  const out: unknown[] = []
  for (const t of targets) {
    const p = rows.find((r) => r.slug === t.slug)
    if (!p) { out.push({ slug: t.slug, error: 'NOT_FOUND' }); continue }
    const cityTerms = t.cities?.length
      ? englishCityTerms(t.cities)
      : englishCityTerms([...(t.extraCities ?? []), p.city, p.cityKey, p.nodeKey, p.primaryDestination])
    const landmarks = (t.landmarks ?? []).map((x) => x.toLowerCase())
    const queries = [...landmarks.map((l) => `${l} ${cityTerms[0] ?? ''}`.trim()), ...cityTerms.slice(0, 2).flatMap((c) => [c, `${c} landmark`, `${c} skyline`])]
    const reasons: Record<CityLocationVerdict | 'USED' | 'SMALL', number> = { OK: 0, NO_LOCATION: 0, EXCLUDED_SUBJECT: 0, CITY_MISMATCH: 0, USED: 0, SMALL: 0 }
    const picks: unknown[] = []
    const seen = new Set<string>()
    for (const q of [...new Set(queries)]) {
      if (picks.length >= 3 || !cityTerms.length) break
      let photos: PexelsPhoto[] = []
      try { photos = await pexelsSearch(q) } catch { continue }
      for (const ph of photos) {
        const id = String(ph.id)
        if (seen.has(id)) continue
        seen.add(id)
        const v = cityLocationVerdict({ alt: ph.alt, pageUrl: ph.url }, cityTerms, landmarks)
        reasons[v.verdict]++
        if (v.verdict !== 'OK') continue
        if (ph.width < 1600 || ph.width < ph.height) { reasons.SMALL++; continue }
        if ((usedIds.has(id) && usedIds.get(id) !== p.slug) || taken.has(id) || (t.excludeIds ?? []).includes(id)) { reasons.USED++; continue }
        picks.push({ id, url: ph.src.original, page: ph.url, alt: ph.alt, photographer: ph.photographer, width: ph.width, height: ph.height, matched: v.matched, query: q })
        if (picks.length >= 3) break
      }
    }
    if (picks[0]) taken.add((picks[0] as { id: string }).id)
    out.push({ slug: p.slug, productId: p.id, title: p.title, city: p.city, cityKey: p.cityKey, primaryDestination: p.primaryDestination, currentImageUrl: p.bgImageUrl, currentSource: p.bgImageSource, cityTerms, landmarks, queries: [...new Set(queries)], reasons, picks })
  }
  writeFileSync(arg('--out') ?? 'out.json', JSON.stringify(out, null, 1))
  console.log(`done targets=${targets.length} withPick=${out.filter((o) => (o as { picks?: unknown[] }).picks?.length).length}`)
}
main().catch((e) => { console.error(String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "<db-url>").slice(-600)); process.exit(1) })
