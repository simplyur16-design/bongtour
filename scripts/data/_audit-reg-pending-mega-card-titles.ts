/**
 * 등록+등록대기 해외 — dest 메가 leaf 정합 + 카드 간단제목 전수 검수.
 *
 *   railway run --service bongtour -- npx tsx scripts/data/_audit-reg-pending-mega-card-titles.ts
 */
import '../load-env-for-scripts'
import { writeFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import {
  alignDestinationToMegaMenuLeaf,
  classifyMegaMenuDestinationLabel,
} from '@/lib/align-destination-to-mega-menu-leaf'
import {
  isPollutedPublicProductTitle,
  resolvePublicBrowseCardTitle,
} from '@/lib/bongtour-product-display-title-ssot'
import { isRegisterDestinationPollutionLabel } from '@/lib/register-destination-finalize'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || process.env.DIRECT_URL,
})

const COUNTRY_SHORT =
  /^(일본|중국|대만|홍콩|마카오|태국|베트남|필리핀|미국|캐나다|호주|프랑스|이탈리아|스페인|영국|독일|튀르키예|터키|그리스|이집트|인도|몽골|괌|사이판|하와이|유럽|올본|스리랑카)\s*\d+\s*박\s*\d+\s*일/u
const EN_SLUG_CARD = /^[a-z][a-z0-9-]{2,}\s*\d+\s*박/u
const JAPAN_UMBRELLA = /^(일본|올본)\s*\d+\s*박/

type Issue = {
  code: string
  status: string
  slug: string | null
  dest: string
  card: string
  title: string
  detail?: string
}

async function main() {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: { in: ['registered', 'pending'] },
      travelScope: 'overseas',
    },
    select: {
      slug: true,
      originCode: true,
      title: true,
      registrationStatus: true,
      primaryDestination: true,
      destination: true,
      destinationRaw: true,
      cityKey: true,
      countryKey: true,
      country: true,
      continent: true,
      duration: true,
    },
  })

  const issues: Issue[] = []
  const kindCounts: Record<string, number> = {}
  const byStatus = {
    registered: { total: 0, destOk: 0, cardOk: 0, issues: 0 },
    pending: { total: 0, destOk: 0, cardOk: 0, issues: 0 },
  }
  const cardSamples: Array<{ status: string; slug: string | null; dest: string; card: string }> = []

  for (const p of rows) {
    const st = (p.registrationStatus === 'pending' ? 'pending' : 'registered') as
      | 'pending'
      | 'registered'
    byStatus[st].total += 1
    const dest = String(p.primaryDestination || p.destination || '').trim()
    const title = String(p.title || '').trim()
    const destKind = classifyMegaMenuDestinationLabel(dest)
    kindCounts[destKind] = (kindCounts[destKind] || 0) + 1

    const aligned = alignDestinationToMegaMenuLeaf({
      current: dest,
      title,
      cityKey: p.cityKey,
      countryKey: p.countryKey,
    })
    const alignedKind = aligned.destination
      ? classifyMegaMenuDestinationLabel(aligned.destination)
      : 'empty'

    let destOk = true
    if (isRegisterDestinationPollutionLabel(dest) || destKind === 'other') {
      destOk = false
      issues.push({
        code: 'dest_polluted_or_other',
        status: st,
        slug: p.slug,
        dest,
        card: '',
        title: title.slice(0, 100),
        detail: destKind,
      })
    } else if (destKind === 'group') {
      destOk = false
      issues.push({
        code: 'dest_group_not_leaf',
        status: st,
        slug: p.slug,
        dest,
        card: '',
        title: title.slice(0, 100),
        detail: aligned.destination
          ? `align→${aligned.destination}(${aligned.reason})`
          : aligned.reason,
      })
    } else if (
      aligned.destination &&
      aligned.destination !== dest &&
      (alignedKind === 'city' || alignedKind === 'country')
    ) {
      destOk = false
      issues.push({
        code: 'dest_needs_align',
        status: st,
        slug: p.slug,
        dest,
        card: '',
        title: title.slice(0, 100),
        detail: `${dest}→${aligned.destination}|${aligned.reason}`,
      })
    }
    if (destOk) byStatus[st].destOk += 1

    const card = resolvePublicBrowseCardTitle(
      {
        title,
        duration: p.duration,
        primaryDestination: p.primaryDestination,
        destination: p.destination,
        destinationRaw: p.destinationRaw,
        countryRowLabel: p.country,
        primaryRegion: p.continent,
        cityKey: p.cityKey,
        countryKey: p.countryKey,
      },
      title,
    )
    const ct = String(card.cardTitle || '').replace(/\s+/g, ' ').trim()
    cardSamples.push({ status: st, slug: p.slug, dest, card: ct })

    let cardOk = true
    if (!ct || ct === '여행') {
      cardOk = false
      issues.push({
        code: 'card_empty_or_generic',
        status: st,
        slug: p.slug,
        dest,
        card: ct,
        title: title.slice(0, 100),
      })
    }
    if (isPollutedPublicProductTitle(ct)) {
      cardOk = false
      issues.push({
        code: 'card_polluted',
        status: st,
        slug: p.slug,
        dest,
        card: ct,
        title: title.slice(0, 100),
      })
    }
    if (EN_SLUG_CARD.test(ct) || /^[a-z][a-z0-9-]+$/i.test(ct.split(/\s/)[0] || '')) {
      // southeast-asia / europe 등 EN 키
      if (/^[a-z]/i.test(ct)) {
        cardOk = false
        issues.push({
          code: 'card_en_slug',
          status: st,
          slug: p.slug,
          dest,
          card: ct,
          title: title.slice(0, 100),
        })
      }
    }
    if (JAPAN_UMBRELLA.test(ct)) {
      // 제목에 도시 leaf가 있는데 일본 N박이면 실패
      const titleCities = [
        '도쿄',
        '오사카',
        '후쿠오카',
        '삿포로',
        '나고야',
        '오키나와',
        '마츠야마',
        '시모노세키',
        '가고시마',
        '나라',
        '교토',
        '고베',
        '히로시마',
        '다카마쓰',
        '시즈오카',
      ]
      if (titleCities.some((c) => title.includes(c))) {
        cardOk = false
        issues.push({
          code: 'card_japan_umbrella_with_city',
          status: st,
          slug: p.slug,
          dest,
          card: ct,
          title: title.slice(0, 100),
        })
      }
    }
    // 국가 short인데 dest가 도시 leaf면 의심 (일본 제외 — 국가 스케일 허용 케이스 있음)
    if (COUNTRY_SHORT.test(ct) && destKind === 'city' && !/^일본\s/.test(ct)) {
      // 스리랑카·괌 등 국가 leaf short는 dest=도시일 때 검토
      const place = ct.replace(/\s*\d+\s*박.*/, '').trim()
      if (place !== dest && classifyMegaMenuDestinationLabel(place) === 'country') {
        // 제목에 도시가 명시되면 bad
        if (title.includes(dest)) {
          cardOk = false
          issues.push({
            code: 'card_country_over_city_dest',
            status: st,
            slug: p.slug,
            dest,
            card: ct,
            title: title.slice(0, 100),
            detail: `dest city ${dest} but card country ${place}`,
          })
        }
      }
    }
    // 해시태그·혜택 잔존
    if (/#|전일정|5성호텔|자유일정|네일아트|해적호핑/.test(ct)) {
      cardOk = false
      issues.push({
        code: 'card_hashtag_or_benefit',
        status: st,
        slug: p.slug,
        dest,
        card: ct,
        title: title.slice(0, 100),
      })
    }
    // N박N일 형태가 아니고 긴 원문 폴백
    if (!card.usedHeroShort && ct.length > 40) {
      cardOk = false
      issues.push({
        code: 'card_long_fallback',
        status: st,
        slug: p.slug,
        dest,
        card: ct.slice(0, 80),
        title: title.slice(0, 100),
      })
    }

    if (cardOk) byStatus[st].cardOk += 1
    else byStatus[st].issues += 1
  }

  const byCode: Record<string, number> = {}
  for (const i of issues) byCode[i.code] = (byCode[i.code] || 0) + 1

  const out = {
    scanned: rows.length,
    byStatus,
    kindCounts,
    issueCount: issues.length,
    byCode,
    issues: issues.slice(0, 500),
    cardSamplesOkPreview: cardSamples
      .filter((s) => !issues.some((i) => i.slug === s.slug && i.status === s.status))
      .slice(0, 40),
  }
  const outPath = path.join(__dirname, '_audit-reg-pending-mega-card-titles.out.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')

  const summary = [
    `scanned=${out.scanned}`,
    `registered: total=${byStatus.registered.total} destOk=${byStatus.registered.destOk} cardOk=${byStatus.registered.cardOk} issueRows=${byStatus.registered.issues}`,
    `pending: total=${byStatus.pending.total} destOk=${byStatus.pending.destOk} cardOk=${byStatus.pending.cardOk} issueRows=${byStatus.pending.issues}`,
    `kindCounts=${JSON.stringify(kindCounts)}`,
    `byCode=${JSON.stringify(byCode)}`,
    '--- issues (first 80) ---',
    ...issues.slice(0, 80).map(
      (i) => `${i.code}|${i.status}|${i.slug}|dest=${i.dest}|card=${i.card}|${i.detail || ''}||${i.title}`,
    ),
  ].join('\n')
  writeFileSync(path.join(__dirname, '_audit-reg-pending-mega-card-titles.report.txt'), summary, 'utf8')
  console.log(summary)
  console.log(`\nout=${outPath}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
