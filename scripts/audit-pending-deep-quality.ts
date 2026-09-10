/**
 * 등록대기 심층 전수 검수 — verify.ok 여도 soft 이상 신호까지 기록.
 * Usage:
 *   npx tsx scripts/audit-pending-deep-quality.ts
 *   npx tsx scripts/audit-pending-deep-quality.ts --apply   # soft/hard 대상 셀프힐
 */
import Module from 'node:module'
import { register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE } from '../lib/register-pre-photo-pending-queue-query'
import {
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhotoForStoredProduct,
} from '../lib/register-pre-photo-verify'
import { isRegisterPrePhotoPendingQueueReady } from '../lib/register-pre-photo-pending-queue'
import {
  productCountryScheduleMismatchIssues,
  strongOtherCountryKeysFromHay,
  PRODUCT_COUNTRY_KEY_CONTENT_EVIDENCE,
  registerPrePhotoScheduleCountryHaystack,
} from '../lib/register-pre-photo-product-country-schedule-guard'
import {
  detectActiveRegisterGeoRegionCluster,
  isPoisonedRegionClusterDestination,
  countryKeyEvidenceInHay,
} from '../lib/register-geo-region-clusters'
import { pendingNeedsCountryScheduleGeoHeal } from '../lib/register-pre-photo-country-schedule-self-heal'
import { isRegisterPrePhotoPlaceLikeDestination } from '../lib/register-schedule-cross-continent-keyword-guard'

register(pathToFileURL(join(process.cwd(), 'scripts/stub-server-only.mjs')).href)
const load = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
) {
  if (request === 'server-only') return {}
  return load.call(this, request, parent, isMain)
}

const ROOT = process.cwd()
for (const f of ['.env.local', '.env']) {
  const p = path.join(ROOT, f)
  if (existsSync(p)) config({ path: p, override: f === '.env.local' })
}

const OUT = path.join(ROOT, 'scripts/data/_tmp_pending_deep_quality.json')

const TITLE_COUNTRY_MARKERS: Array<{ key: string; re: RegExp }> = [
  { key: 'vietnam', re: /베트남|다낭|호이안|푸꾸옥|나트랑|하노이|호치민|바나힐/i },
  { key: 'japan', re: /일본|오사카|도쿄|홋카이도|북해도|후쿠오카|오키나와|교토/i },
  { key: 'switzerland', re: /스위스|융프라우|인터라켄|루체른|취리히/i },
  { key: 'iceland', re: /아이슬란드|오로라|블루라군|레이캬비크/i },
  { key: 'egypt', re: /이집트|카이로|피라미드|룩소르/i },
  { key: 'jordan', re: /요르단|페트라|와디럼|암만/i },
  { key: 'philippines', re: /필리핀|보라카이|보홀|세부|마닐라/i },
  { key: 'china', re: /중국|장가계|태항|베이징|상해|서안/i },
  { key: 'turkey', re: /터키|튀르키예|이스탄불|카파도키아/i },
  { key: 'italy', re: /이탈리아|이태리|로마|베니스|시칠리아/i },
  { key: 'france', re: /프랑스|파리(?![가-힣])/i },
  { key: 'spain', re: /스페인|마드리드|바르셀로나/i },
  { key: 'portugal', re: /포르투갈|리스본|파티마/i },
  { key: 'canada', re: /캐나다|나이아가라|토론토|퀘벡/i },
  { key: 'united-states', re: /미동부|미서부|뉴욕|하와이|미국/i },
  { key: 'nordic-baltic', re: /발틱|발트\s*3|발틱3|북유럽\s*\d/i },
  { key: 'malaysia', re: /말레이|코타키나발루|랑카위|쿠알라룸푸르/i },
  { key: 'thailand', re: /태국|방콕|푸켓|치앙마이/i },
  { key: 'indonesia', re: /인도네시아|발리(?![가-힣])/i },
  { key: 'australia', re: /호주|시드니|멜버른|골드코스트/i },
]

function titleCountryKeys(title: string): string[] {
  return TITLE_COUNTRY_MARKERS.filter((m) => m.re.test(title)).map((m) => m.key)
}

function softFlagsForProduct(args: {
  countryKey: string | null
  title: string
  destination: string | null
  rows: ReturnType<typeof scheduleRowsForPrePhotoVerify>
}): string[] {
  const flags: string[] = []
  const ck = String(args.countryKey ?? '').trim()
  const title = args.title
  const dest = String(args.destination ?? '')
  const rows = args.rows
  const hay = registerPrePhotoScheduleCountryHaystack(title, dest, rows)
  const bodyHay = rows.map((r) => `${r.routeText ?? ''}\n${r.description ?? ''}`).join('\n')

  if (isPoisonedRegionClusterDestination(dest)) flags.push('dest_region_nudge_poison')
  if (dest && !isRegisterPrePhotoPlaceLikeDestination(dest)) flags.push('dest_not_place_like')
  if (/비자|미팅 관련|예약 시 참고|상세보기|HIGH&|비즈니스/.test(dest)) flags.push('dest_junk_phrase')

  const titleKeys = titleCountryKeys(title)
  if (ck && titleKeys.length) {
    const titleOk =
      titleKeys.includes(ck) ||
      (ck === 'nordic-baltic' && titleKeys.some((k) => ['lithuania', 'latvia', 'estonia', 'iceland', 'nordic-baltic'].includes(k))) ||
      (ck === 'africa' && titleKeys.some((k) => ['egypt', 'tunisia', 'kenya', 'tanzania', 'africa'].includes(k))) ||
      (ck === 'latin-caribbean' &&
        titleKeys.some((k) => ['peru', 'brazil', 'mexico', 'argentina', 'latin-caribbean'].includes(k))) ||
      (ck === 'spain' && titleKeys.includes('portugal')) ||
      (ck === 'portugal' && titleKeys.includes('spain')) ||
      (ck === 'egypt' && titleKeys.includes('jordan')) ||
      (ck === 'austria' && titleKeys.some((k) => ['czech', 'hungary', 'italy', 'germany'].includes(k)))
    if (!titleOk && !titleKeys.includes(ck)) {
      // title names a clear other country and not ck
      const foreign = titleKeys.filter((k) => k !== ck)
      if (foreign.length && !(ck === 'egypt' && foreign.includes('jordan'))) {
        flags.push(`title_country_vs_ck:${foreign.join(',')}`)
      }
    }
  }

  // 제목에 N국/다국 표기인데 단일국 + 권역 아님
  if (/\d+\s*국|[/·]\s*[가-힣]{2,}/.test(title) && ck && !['nordic-baltic', 'latin-caribbean', 'africa', 'caucasus'].includes(ck)) {
    const cluster = detectActiveRegisterGeoRegionCluster({ hay, productTitle: title })
    if (cluster?.requireRegionalWhenMulti && cluster.regionalKey && ck !== cluster.regionalKey) {
      flags.push(`multi_title_expect_regional:${cluster.regionalKey}`)
    }
  }

  const poisonDays: number[] = []
  const maxDay = Math.max(0, ...rows.map((r) => Number(r.day) || 0))
  for (const r of rows) {
    const t = String(r.title ?? '').trim()
    if (!t) continue
    const day = Number(r.day) || 0
    const dayBody = `${r.routeText ?? ''}\n${r.description ?? ''}`
    if (/^상세보기$/i.test(t)) {
      poisonDays.push(day)
      continue
    }
    if (/쿠알라룸푸르|kuala\s*lumpur/i.test(t) && ck !== 'malaysia' && !/쿠알라|kuala|말레이/i.test(dayBody)) {
      poisonDays.push(day)
      continue
    }
    if (
      day === maxDay &&
      /^(?:두바이|dubai)$/i.test(t) &&
      ck !== 'united-arab-emirates' &&
      ck !== 'dubai'
    ) {
      poisonDays.push(day)
    }
  }
  if (poisonDays.length) flags.push(`poison_day_title:${poisonDays.join(',')}`)

  // 키워드가 제목 나라와 다른 강한 나라
  for (const r of rows) {
    const kw = `${r.imageKeyword ?? ''} ${r.imageKeyword2 ?? ''}`
    if (!kw.trim() || !ck) continue
    const others = strongOtherCountryKeysFromHay(kw, ck)
    if (others.length && !countryKeyEvidenceInHay(ck, kw)) {
      flags.push(`kw_foreign_day${r.day}:${others.slice(0, 2).join(',')}`)
    }
  }

  // ck 증거가 본문에 없고 제목에만 있음
  if (ck && PRODUCT_COUNTRY_KEY_CONTENT_EVIDENCE[ck]) {
    const inBody = PRODUCT_COUNTRY_KEY_CONTENT_EVIDENCE[ck]!.test(bodyHay)
    const inTitle = PRODUCT_COUNTRY_KEY_CONTENT_EVIDENCE[ck]!.test(title)
    if (inTitle && !inBody && bodyHay.trim().length > 40) {
      const bodyOthers = strongOtherCountryKeysFromHay(bodyHay, ck)
      if (bodyOthers.length) flags.push(`ck_title_only_body_foreign:${bodyOthers.slice(0, 3).join(',')}`)
    }
  }

  // 빈 중간일 키워드
  for (const r of rows) {
    const d = Number(r.day) || 0
    if (d <= 1 || d >= maxDay) continue
    if (!String(r.imageKeyword ?? '').trim()) flags.push(`middle_kw_empty:D${d}`)
  }

  return [...new Set(flags)]
}

async function main() {
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient()
  const healMod = apply ? await import('../lib/register-pending-pre-photo-self-heal') : null

  try {
    const rows = await prisma.product.findMany({
      where: REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
      select: {
        id: true,
        title: true,
        originSource: true,
        countryKey: true,
        destination: true,
        schedule: true,
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        registrationStatus: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const report: Array<Record<string, unknown>> = []
    let liveOk = 0
    let hardFail = 0
    let softFail = 0
    let healed = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      const sched = scheduleRowsForPrePhotoVerify(r.schedule)
      const v = verifyRegisterPrePhotoForStoredProduct(r)
      const ok = isRegisterPrePhotoPendingQueueReady(v)
      if (ok) liveOk += 1
      else hardFail += 1

      const mismatch = productCountryScheduleMismatchIssues({
        countryKey: r.countryKey,
        productTitle: r.title,
        productDestination: r.destination,
        rows: sched,
      })
      const soft = softFlagsForProduct({
        countryKey: r.countryKey,
        title: String(r.title ?? ''),
        destination: r.destination,
        rows: sched,
      })
      const needsGeo = pendingNeedsCountryScheduleGeoHeal({
        countryKey: r.countryKey,
        productTitle: r.title,
        productDestination: r.destination,
        rows: sched,
      })

      if (soft.length) softFail += 1

      const item: Record<string, unknown> = {
        id: r.id,
        src: r.originSource,
        ck: r.countryKey,
        title: String(r.title ?? '').slice(0, 100),
        dest: String(r.destination ?? '').slice(0, 50),
        liveOk: ok,
        hardIssues: v.issues.slice(0, 15),
        countryMismatch: mismatch,
        soft,
        needsGeo,
        dayTitles: sched
          .map((d) => `D${d.day}:${String(d.title ?? '').slice(0, 16)}`)
          .join('|')
          .slice(0, 200),
      }

      const shouldHeal = apply && healMod && (!ok || needsGeo || mismatch.length > 0 || soft.some((s) =>
        s.startsWith('title_country_vs_ck') ||
        s.startsWith('ck_title_only_body_foreign') ||
        s.startsWith('dest_region_nudge_poison') ||
        s.startsWith('poison_day_title') ||
        s.startsWith('multi_title_expect_regional'),
      ))

      if (shouldHeal) {
        const result = await healMod!.healPendingRegisterPrePhoto({
          productId: r.id,
          limit: 1,
          dryRun: false,
          probeImageUrls: false,
        })
        healed += 1
        const after = await prisma.product.findUnique({
          where: { id: r.id },
          select: {
            countryKey: true,
            destination: true,
            registrationStatus: true,
            title: true,
            schedule: true,
            listingKind: true,
            productType: true,
            sportsThemeTag: true,
          },
        })
        if (after) {
          const v2 = verifyRegisterPrePhotoForStoredProduct({ ...r, ...after })
          const soft2 = softFlagsForProduct({
            countryKey: after.countryKey,
            title: String(after.title ?? r.title ?? ''),
            destination: after.destination,
            rows: scheduleRowsForPrePhotoVerify(after.schedule),
          })
          item.after = {
            ck: after.countryKey,
            dest: String(after.destination ?? '').slice(0, 40),
            st: after.registrationStatus,
            liveOk: isRegisterPrePhotoPendingQueueReady(v2),
            soft: soft2,
            heal: {
              healed: result.healed,
              verified: result.verified,
              blocked: result.blocked,
            },
          }
        }
      }

      if (!ok || soft.length || mismatch.length) report.push(item)
      if ((i + 1) % 25 === 0 || i === rows.length - 1) {
        console.log(`[deep] ${i + 1}/${rows.length} live=${liveOk} soft=${softFail} hard=${hardFail} healed=${healed}`)
      }
    }

    // severity buckets
    const softCounts: Record<string, number> = {}
    for (const row of report) {
      for (const s of (row.soft as string[]) ?? []) {
        const k = s.replace(/:.*$/, '').replace(/day\d+/, 'dayN')
        softCounts[k] = (softCounts[k] || 0) + 1
      }
    }

    const summary = {
      scanned: rows.length,
      liveOk,
      hardFail,
      softFlagged: softFail,
      healed,
      apply,
      softCounts,
      hardIds: report.filter((r) => !r.liveOk).map((r) => r.id),
      softIds: report.filter((r) => (r.soft as string[]).length > 0).map((r) => r.id),
      stillSoftAfter: report
        .filter((r) => {
          const after = r.after as { soft?: string[] } | undefined
          if (!after) return (r.soft as string[]).length > 0
          return (after.soft ?? []).length > 0
        })
        .map((r) => r.id),
    }

    mkdirSync(path.dirname(OUT), { recursive: true })
    writeFileSync(OUT, JSON.stringify({ summary, suspects: report }, null, 2), 'utf8')
    console.log(JSON.stringify(summary, null, 2))
    console.log(`[deep] wrote ${OUT}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
