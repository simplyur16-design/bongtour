/**
 * 사진 자동 채움·야간 점검 드라이런(읽기 전용).
 * - DB: BEGIN READ ONLY … ROLLBACK 만(쓰기·세션 SET 없음).
 * - 외부: Pexels·Unsplash 검색(순차·간격+지터) + 공개 상품 사진 HEAD(순차·간격+지터). 업로드·DB 쓰기 없음.
 * - 키·접속 문자열은 출력하지 않는다.
 *
 * 사용: npx tsx scripts/photo-autofill-dry-run.ts [--slots 15] [--nightly-window] [--head-all]
 * 결과: .review-out/photo-autofill-1114/ 아래 CSV·MD
 */
import fs from 'node:fs'
import path from 'node:path'
import { acquireVerifiedPhoto, type AcquireDeps } from '@/lib/photo-autofill-acquire'
import { buildPublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { createLiveAcquireDeps } from '@/lib/photo-autofill-live-deps'
import { urlsNeedingPoolId } from '@/lib/photo-autofill-public-usage'
import { deriveDaySights } from '@/lib/photo-autofill-sight'
import { destinationTermsOf } from '@/lib/photo-gate-runner'
import {
  checkPhotoUrl,
  nightlyProductWindow,
  planDuplicateIssues,
  slotsOfProduct,
  NIGHTLY_HEAD_GAP_MS,
  NIGHTLY_HEAD_JITTER_MS,
  type PublicProductPhotos,
} from '@/lib/photo-nightly-audit'
import { missingDayFillAction } from '@/lib/register-auto-photo-missing-day'

const OUT = path.join(process.cwd(), '.review-out', 'photo-autofill-1114')
const ENV_FILE = 'C:/Users/USER/Desktop/BONGTOUR/.env.local'

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    const i = t.indexOf('=')
    if (!t || t.startsWith('#') || i <= 0) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[t.slice(0, i).trim()] = v
  }
  return env
}

const args = process.argv.slice(2)
const argNum = (k: string, d: number) => {
  const i = args.indexOf(k)
  return i >= 0 ? Number(args[i + 1]) || d : d
}
const SLOTS = argNum('--slots', 15)
const HEAD_ALL = args.includes('--head-all')
const SKIP_SLOTS = args.includes('--no-slots')
const DUP_ONLY = args.includes('--dup-only')

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`

async function main() {
  const env = loadEnv()
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
  const pgMod = (await import('pg')) as unknown as { Client?: typeof import('pg').Client; default?: { Client: typeof import('pg').Client } }
  const Client = (pgMod.Client ?? pgMod.default!.Client) as typeof import('pg').Client
  const connUrl = env.DIRECT_URL || env.DATABASE_URL
  const client = new Client({ connectionString: connUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  fs.mkdirSync(OUT, { recursive: true })
  try {
    await client.query('BEGIN READ ONLY')
    const registered = (
      await client.query(
        `SELECT id::text AS id, "createdAt", "bgImageUrl", "bgImageExternalId", "bgImageSourceUrl", "bgImageSource",
                "bgImageRehostSearchLabel", destination, "primaryDestination", schedule
           FROM "Product" WHERE "registrationStatus" = 'registered'`,
      )
    ).rows as Array<Record<string, unknown>>
    const pending = SKIP_SLOTS
      ? []
      : ((
          await client.query(
            `SELECT id::text AS id, title, destination, "primaryDestination", schedule
               FROM "Product"
              WHERE ("registrationStatus" IS NULL OR "registrationStatus" = '' OR "registrationStatus" = 'pending')
                AND schedule IS NOT NULL
              ORDER BY "updatedAt" ASC LIMIT 400`,
          )
        ).rows as Array<Record<string, unknown>>)

    const products: PublicProductPhotos[] = registered.map((r) => ({
      id: String(r.id),
      createdAt: r.createdAt as Date,
      bgImageUrl: (r.bgImageUrl as string) ?? null,
      bgImageExternalId: (r.bgImageExternalId as string) ?? null,
      bgImageSourceUrl: (r.bgImageSourceUrl as string) ?? null,
      bgImageSource: (r.bgImageSource as string) ?? null,
      bgImageRehostSearchLabel: (r.bgImageRehostSearchLabel as string) ?? null,
      destination: (r.destination as string) ?? null,
      primaryDestination: (r.primaryDestination as string) ?? null,
      schedule: (r.schedule as string) ?? null,
    }))
    const usageRows = products.map((p) => ({ productId: p.id, bgImageUrl: p.bgImageUrl, bgImageExternalId: p.bgImageExternalId, bgImageSourceUrl: p.bgImageSourceUrl, schedule: p.schedule }))
    const poolIdByUrl = new Map<string, string>()
    const need = urlsNeedingPoolId(usageRows)
    for (let i = 0; i < need.length; i += 400) {
      const chunk = need.slice(i, i + 400)
      const { rows } = await client.query(`SELECT "filePath", "sourcePhotoId" FROM "PhotoPool" WHERE "filePath" = ANY($1::text[]) AND "sourcePhotoId" IS NOT NULL`, [chunk])
      for (const r of rows as Array<{ filePath: string; sourcePhotoId: string }>) poolIdByUrl.set(r.filePath, r.sourcePhotoId)
    }
    await client.query('ROLLBACK')
    const usage = buildPublicPhotoUsage(usageRows, poolIdByUrl)
    console.log(`[dry-run] registered=${products.length} pending-scanned=${pending.length} usageKeys=${usage.size}`)

    if (!SKIP_SLOTS && !DUP_ONLY) await runSlots(pending, usage)
    if (DUP_ONLY) await writeCoverDuplicates(products)
    else await runNightly(products, HEAD_ALL)
  } finally {
    await client.end().catch(() => {})
  }
}

type SlotRow = { productId: string; title: string; destination: string; primaryDestination: string | null; day: number; row: Record<string, unknown>; maxDay: number }

function pickSlots(pending: Array<Record<string, unknown>>, n: number): SlotRow[] {
  const out: SlotRow[] = []
  const seenDest = new Map<string, number>()
  for (const p of pending) {
    if (out.length >= n) break
    let rows: unknown
    try {
      rows = JSON.parse(String(p.schedule))
    } catch {
      continue
    }
    if (!Array.isArray(rows)) continue
    const maxDay = rows.reduce((m: number, r: Record<string, unknown>) => Math.max(m, Number(r?.day) || 0), 0)
    const dest = String(p.destination ?? '')
    if ((seenDest.get(dest) ?? 0) >= 1) continue
    for (const r of rows as Array<Record<string, unknown>>) {
      if (String(r.imageUrl ?? '').trim()) continue
      const action = missingDayFillAction({ day: Number(r.day), title: String(r.title ?? ''), description: String(r.description ?? ''), routeText: String(r.routeText ?? ''), imageKeyword: String(r.imageKeyword ?? ''), imageUrl: null } as never, maxDay)
      if (action !== 'fill') continue
      out.push({ productId: String(p.id), title: String(p.title ?? ''), destination: dest, primaryDestination: (p.primaryDestination as string) ?? null, day: Number(r.day), row: r, maxDay })
      seenDest.set(dest, (seenDest.get(dest) ?? 0) + 1)
      break
    }
  }
  return out
}

async function runSlots(pending: Array<Record<string, unknown>>, usage: ReturnType<typeof buildPublicPhotoUsage>) {
  const slots = pickSlots(pending, SLOTS)
  console.log(`[dry-run] sample slots=${slots.length}`)
  const lines: string[] = ['product,title,day,derived_sights,search_term,adopted_tier,adopted_id,adopted_title,result,top_reasons,tried']
  const md: string[] = ['| # | 상품 | 일차 | 그날 방문지(추출) | 검색어 | 채택 후보(id · 제목) | 결과 | 탈락 사유(상위) |', '|---|---|---|---|---|---|---|---|']
  let pass = 0
  let exc = 0
  let skipped = 0
  for (const [i, s] of slots.entries()) {
    const { terms, cityTerms } = destinationTermsOf({ destination: s.destination, primaryDestination: s.primaryDestination })
    const dayFacts = {
      title: String(s.row.title ?? ''),
      routeText: String(s.row.routeText ?? ''),
      description: String(s.row.description ?? ''),
      imageKeyword: String(s.row.imageKeyword ?? ''),
      imageKeyword2: String(s.row.imageKeyword2 ?? ''),
    }
    const derived = deriveDaySights(dayFacts, terms.join(' '))
    const seen = new Map<string, AutofillCandidate>()
    const live = createLiveAcquireDeps({ prisma: null as never, destination: s.destination, probe: async () => ({ bytes: null, width: null }) })
    const deps: AcquireDeps = {
      ...live,
      search: async (tier, q, n) => {
        const r = await live.search(tier, q, n)
        for (const c of r) seen.set(`${c.source}:${c.id}`, c)
        return r
      },
      commit: async (c) => ({ ok: true, url: c.url, bytes: 1, width: c.width, source: c.source, photographer: String(c.photographer ?? ''), originalLink: String(c.originalLink ?? ''), externalId: c.id }),
    }
    const res = await acquireVerifiedPhoto(
      { productId: s.productId, kind: 'day', day: s.day, dayFacts, cityTerms, destinationText: [...terms, String(s.row.title ?? '')].join(' '), usage, origin: 'autofill' },
      deps,
    )
    const short = s.productId.slice(-6)
    let result = ''
    let adoptedTier = ''
    let adoptedId = ''
    let adoptedTitle = ''
    let top = ''
    let term = ''
    if (res.ok) {
      pass++
      adoptedTier = res.photo.source
      adoptedId = res.photo.externalId ?? ''
      const c = seen.get(`${res.photo.source}:${adoptedId}`)
      adoptedTitle = String(c?.altText ?? c?.title ?? c?.description ?? '').slice(0, 80)
      result = `PASS(방문지 일치: ${res.photo.matched})`
      term = res.photo.query
    } else if (res.skipped) {
      skipped++
      result = `SKIP(${res.exception.reason})`
    } else {
      exc++
      result = `EXCEPTION(${res.exception.reason})`
      top = res.exception.detail
      term = res.exception.query ?? ''
    }
    const rejects = res.tried.filter((t) => t.outcome === 'rejected').flatMap((t) => t.reasons)
    const counts = new Map<string, number>()
    for (const r of rejects) counts.set(r, (counts.get(r) ?? 0) + 1)
    const topReasons = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}×${n}`).join(' ')
    lines.push([short, s.title.slice(0, 40), s.day, derived.sights.join(' | '), term, adoptedTier, adoptedId, adoptedTitle, result, topReasons || top, res.tried.length].map(csv).join(','))
    md.push(`| ${i + 1} | ${short} ${s.title.slice(0, 24)} | ${s.day} | ${derived.sights.join(' / ') || '-'} | ${term || '-'} | ${adoptedId ? `${adoptedTier} ${adoptedId} · ${adoptedTitle}` : '-'} | ${result} | ${topReasons || top || '-'} |`)
    console.log(`[dry-run] slot ${i + 1}/${slots.length} ${short} d${s.day} -> ${result}`)
  }
  md.push('', `PASS ${pass} · 예외 ${exc} · 건너뜀(방문지 없음) ${skipped} · 합계 ${slots.length}`, '', '저장본 용량(카드 200,000B·상세 400,000B)은 업로드 뒤에만 측정되므로 드라이런은 원본 해상도·가로형·이름 일치·인물·공개 중복까지 확인한다.')
  fs.writeFileSync(path.join(OUT, 'dry-run-slots.csv'), '\uFEFF' + lines.join('\n'), 'utf8')
  fs.writeFileSync(path.join(OUT, 'dry-run-slots.md'), md.join('\n'), 'utf8')
}

async function writeCoverDuplicates(products: PublicProductPhotos[]) {
  const dup = planDuplicateIssues(products)
  const dupProducts = new Set(dup.map((d) => d.productId))
  const covers = products.filter((p) => String(p.bgImageUrl ?? '').trim()).length
  const md = [
    `# 대표 사진 기준 중복 (${new Date().toISOString()})`,
    '',
    `- 공개 상품 ${products.length}개 · 대표 사진 있는 상품 ${covers}개`,
    `- 대표 중복(다른 공개 상품 대표와 같은 사진): ${dup.length}칸 / ${dupProducts.size}개 상품`,
    '- 일차 사진은 중복으로 세지 않는다. 먼저 만든 상품이 대표를 갖고, 나중 상품의 대표만 센다.',
  ]
  fs.writeFileSync(path.join(OUT, 'cover-duplicates.md'), md.join('\n'), 'utf8')
  fs.writeFileSync(path.join(OUT, 'cover-duplicates.csv'), '\uFEFFproduct,kind,day,url,detail\n' + dup.map((d) => [d.productId, d.kind, d.day ?? '', d.url, d.detail].map(csv).join(',')).join('\n'), 'utf8')
  console.log(md.join('\n'))
}

async function runNightly(products: PublicProductPhotos[], headAll: boolean) {
  const dup = planDuplicateIssues(products)
  const dupProducts = new Set(dup.map((d) => d.productId))
  const totalSlots = products.reduce((n, p) => n + slotsOfProduct(p).length, 0)
  console.log(`[dry-run] nightly duplicates slots=${dup.length} products=${dupProducts.size} totalSlots=${totalSlots}`)

  const scan = headAll ? products : nightlyProductWindow(products, new Date())
  const urls = [...new Set(scan.flatMap((p) => slotsOfProduct(p).map((s) => s.url)))]
  console.log(`[dry-run] HEAD targets=${urls.length} (products=${scan.length}, all=${headAll})`)
  const head = async (url: string) => {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15000)
    try {
      const r = await fetch(url, { method: 'HEAD', signal: ac.signal })
      return { status: r.status }
    } catch (e) {
      return { status: null, error: e instanceof Error ? e.name : 'Error' }
    } finally {
      clearTimeout(t)
    }
  }
  const pause = () => sleep(NIGHTLY_HEAD_GAP_MS + Math.floor(Math.random() * NIGHTLY_HEAD_JITTER_MS))
  const broken: string[] = []
  const skipRows: string[] = []
  let ok = 0
  for (const [i, u] of urls.entries()) {
    await pause()
    const o = await checkPhotoUrl(u, head, pause)
    if (o.outcome === 'ok') ok++
    else if (o.outcome === 'broken') broken.push(`${csv(u)},${csv(o.reason)}`)
    else skipRows.push(`${csv(u)},${csv(o.reason)}`)
    if ((i + 1) % 50 === 0) console.log(`[dry-run] HEAD ${i + 1}/${urls.length} broken=${broken.length} skip=${skipRows.length}`)
  }
  const brokenUrls = new Set(broken.map((b) => b.split('","')[0]!.replace(/^"/, '')))
  const brokenSlots = scan.flatMap((p) => slotsOfProduct(p).filter((s) => brokenUrls.has(s.url)).map((s) => `${p.id.slice(-6)}:${s.kind}:${s.day ?? 'cover'}`))
  const md = [
    `# 야간 점검 읽기 전용 결과 (${new Date().toISOString()})`,
    '',
    `- 공개 상품 ${products.length}개 · 사진 칸 ${totalSlots}개`,
    `- 대표 중복(다른 공개 상품 대표와 같은 사진): ${dup.length}칸 / ${dupProducts.size}개 상품 (먼저 만든 상품이 대표를 보유, 나중 상품의 대표만 교체 대상. 일차 사진은 세지 않음)`,
    `- HEAD 점검 범위: ${headAll ? '전체' : '이번 밤 점검 창'} 상품 ${scan.length}개 · 고유 주소 ${urls.length}개`,
    `- 깨짐(재확인에서도 4xx): ${broken.length}개 주소 / ${brokenSlots.length}칸`,
    `- 외부 장애 SKIP(5xx·429·시간초과): ${skipRows.length}개 주소`,
    `- 정상: ${ok}개 주소`,
  ]
  fs.writeFileSync(path.join(OUT, headAll ? 'dry-run-nightly-all.md' : 'dry-run-nightly.md'), md.join('\n'), 'utf8')
  fs.writeFileSync(path.join(OUT, headAll ? 'dry-run-nightly-all-broken.csv' : 'dry-run-nightly-broken.csv'), '\uFEFFurl,reason\n' + broken.join('\n'), 'utf8')
  fs.writeFileSync(path.join(OUT, headAll ? 'dry-run-nightly-all-duplicates.csv' : 'dry-run-nightly-duplicates.csv'), '\uFEFFproduct,kind,day,url,detail\n' + dup.map((d) => [d.productId, d.kind, d.day ?? '', d.url, d.detail].map(csv).join(',')).join('\n'), 'utf8')
  console.log(md.join('\n'))
}

main().catch((e) => {
  console.error('ERR', e instanceof Error ? e.message : e)
  process.exit(1)
})
