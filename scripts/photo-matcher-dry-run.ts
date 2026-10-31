/**
 * 사진 자동 채움 매처 dry-run — DB·버킷 쓰기 없음, 네트워크도 없음(검색 결과 JSON 을 읽어서 고른다).
 * process-images v2 경로와 같은 순서·같은 거름: 출처 순서(Pexels → Unsplash → CC0 없음),
 * 가로 1200px+, 기존 photoSubjectBlockReason(requirePlaceMatch) + 새 photoMatchGate + (일차) dayCandidateCityMatch,
 * 고르기는 rankPhotosByScore.
 *
 *   tsx scripts/photo-matcher-dry-run.ts queries <slots.json>                 → 슬롯별 검색어(JSON) 출력
 *   tsx scripts/photo-matcher-dry-run.ts run <slots.json> <search.json> <out.json> [used-ids.json]
 *     search.json: { [query]: Array<{id,w,h,alt,url,photographer,original}> }  (Pexels 검색 응답에서 뽑은 것)
 */
import fs from 'node:fs'
import { findStockPhotoByChain, type ChainCandidate } from '@/lib/register-photo-source-chain'
import { photoMatchGate, sortByMatchGateScore, type MatchGateContext } from '@/lib/register-photo-match-gate'
import { photoCandidateText, photoSubjectBlockReason } from '@/lib/register-photo-subject-filter'
import { dayCandidateCityMatch } from '@/lib/register-day-photo-policy'
import { rankPhotosByScore } from '@/lib/register-photo-score'
import { mapDestination } from '@/lib/pexels-keyword'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

type Slot = {
  slug: string
  id: string
  day: number
  slot: 'main' | 'day'
  destination: string
  primaryDestination?: string | null
  mainLabel?: string | null
  dayTitle?: string | null
  routeText?: string | null
  description?: string | null
  imageKeyword?: string | null
  itCity?: string | null
  itPoi?: string | null
  productText: string
}

function mainQueryOf(s: Slot): string {
  const destEn = mapDestination(s.primaryDestination ?? s.destination)
  return normalizeToPlaceName(s.mainLabel ?? '') || normalizeToPlaceName(destEn) || s.destination
}
function slotQuery(s: Slot): string {
  if (s.slot === 'main') return mainQueryOf(s)
  return normalizeToPlaceName(s.imageKeyword ?? '') || mainQueryOf(s)
}

function gateCtx(s: Slot, query: string): MatchGateContext {
  const destEn = mapDestination(s.primaryDestination ?? s.destination)
  if (s.slot === 'main')
    return { placeTerms: [query, s.mainLabel], destinationTerms: [s.destination, destEn], slotText: s.productText, slot: 'main' }
  return {
    placeTerms: [s.imageKeyword, s.itCity, mapDestination(s.itCity ?? null)],
    destinationTerms: [s.destination, destEn],
    slotText: [s.dayTitle, s.routeText, s.description, s.itCity, s.itPoi, s.destination].map((x) => String(x ?? '')).join(' '),
    slot: 'day',
    daySummary: [s.dayTitle, String(s.description ?? '').trim() ? s.description : s.routeText].map((x) => String(x ?? '')).join(' '),
  }
}

async function main() {
  const [mode, slotsPath, searchPath, outPath, usedPath] = process.argv.slice(2)
  const slots: Slot[] = JSON.parse(fs.readFileSync(slotsPath, 'utf8'))
  if (mode === 'queries') {
    console.log(JSON.stringify(slots.map((s) => ({ slug: s.slug, day: s.day, query: slotQuery(s), destQuery: mainQueryOf(s) }))))
    return
  }
  const search: Record<string, Array<Record<string, unknown>>> = JSON.parse(fs.readFileSync(searchPath, 'utf8'))
  const usedIds = new Set<string>()
  if (usedPath && fs.existsSync(usedPath)) {
    const u = JSON.parse(fs.readFileSync(usedPath, 'utf8')) as Record<string, string[]>
    for (const arr of Object.values(u)) for (const x of arr) if (x) usedIds.add(String(x))
  }
  const results = []
  for (const s of slots) {
    const query = slotQuery(s)
    const ctx = gateCtx(s, query)
    const destEn = mapDestination(s.primaryDestination ?? s.destination)
    const rejects: Record<string, number> = {}
    const bump = (k: string) => (rejects[k] = (rejects[k] ?? 0) + 1)
    const chainOpts = {
      deps: {
        searchPexels: async (q) =>
          (search[q] ?? []).map((p) => ({
            pexelsId: Number(p.id),
            imageUrl: String(p.original ?? ''),
            photographer: String(p.photographer ?? ''),
            width: Number(p.w ?? 0),
            height: Number(p.h ?? 0),
            originalLink: String(p.url ?? ''),
            queryUsed: q,
            altText: String(p.alt ?? ''),
          })),
        searchUnsplash: async () => [], // Unsplash 키 없음 → 0건(지어내지 않음)
        triggerDownload: async () => undefined,
      },
      accept: (c: ChainCandidate) => {
        // 문과장 10/31: 이미 쓴 사진도 그날 일정 장소면 다시 쓸 수 있다(pick 에서 안 쓴 사진 먼저)
        if (usedIds.has(c.externalId)) bump('already_used(재사용 가능)')
        const why = photoSubjectBlockReason(
          photoCandidateText([c.altText, c.pageUrl ?? c.originalLink]),
          { destination: s.destination, destinationEn: destEn, productText: s.productText, query: c.queryUsed },
          { requirePlaceMatch: false } // 관문이 장소 일치를 본다(process-images v2 와 같음)
        )
        if (why) return bump(`subject:${why}`), false
        const g = photoMatchGate(
          { altText: c.altText, pageUrl: c.pageUrl ?? c.originalLink, width: c.width, height: c.height, photographer: c.photographer, originalLink: c.originalLink, externalId: c.externalId },
          ctx
        )
        if (!g.ok) return bump(`gate:${g.reason}`), false
        // process-images v2: dayCityOk = 기존 도시 메타 일치 || 관문 통과 (관문은 위에서 이미 통과)
        return true
      },
      pick: (cands) => {
        const sorted = sortByMatchGateScore(rankPhotosByScore(cands, { keywords: [query, destEn] }), ctx)
        return sorted.find((c) => !usedIds.has(c.externalId)) ?? sorted[0] ?? null
      },
    }
    const r1 = await findStockPhotoByChain(query, chainOpts)
    // process-images v2 와 같게: 일차 키워드로 없으면 상품 대표 장소 검색어로 한 번 더
    const mq = mainQueryOf(s)
    const r = !r1.photo && s.slot === 'day' && mq !== query ? await findStockPhotoByChain(mq, chainOpts) : r1
    const usedQuery = r === r1 ? query : mq
    if (r !== r1) r.tried.unshift(...r1.tried.map((x) => `${query}→${x}`))
    const p = r.photo
    const reused = Boolean(p && usedIds.has(p.externalId))
    if (p) usedIds.add(p.externalId)
    results.push({
      slug: s.slug,
      day: s.day,
      slot: s.slot,
      query: usedQuery,
      tried: r.tried,
      rejects,
      reused,
      picked: p
        ? { source: p.source, id: p.externalId, url: p.originalLink, image: p.url, author: p.photographer, width: p.width, height: p.height, alt: p.altText ?? '', aiFlag: false }
        : null,
    })
  }
  fs.writeFileSync(outPath, JSON.stringify(results, null, 1))
  for (const x of results) console.log(x.slug, x.day, x.query, x.tried.join(' '), x.picked ? `${x.picked.id} ${x.picked.alt.slice(0, 70)}` : 'NONE', JSON.stringify(x.rejects))
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
