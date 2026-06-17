#!/usr/bin/env tsx
/**
 * PR 2 통합 테스트 — 카드뉴스 1편 실제 생성 검증.
 *
 *   npx tsx scripts/pr2-card-news-integration-test.ts          # 시드 → 생성 → 검증 (테스트 데이터 유지)
 *   npx tsx scripts/pr2-card-news-integration-test.ts --cleanup # 위 + 끝나고 테스트 시리즈 삭제
 *
 * 서버/관리자 토큰 없이 generateCardNewsEpisode 를 직접 호출한다.
 * 실제 Gemini 호출(과금) + 실제 Supabase 쓰기가 발생한다.
 */
import './load-env-for-scripts'
import { prisma } from '@/lib/prisma'
import { generateCardNewsEpisode } from '@/lib/bong-marketing/card-news-generator'

const SERIES_ID = 'test-series-1'
const EPISODE_ID = 'test-ep-1'
const WEEK_KEY = '2026-W25'

async function seed() {
  await prisma.bongCardNewsSeries.upsert({
    where: { id: SERIES_ID },
    create: {
      id: SERIES_ID,
      weekKey: WEEK_KEY,
      themeTitle: '여름 몽골',
      selectedCities: ['울란바토르'],
      tripNights: 4,
      tripDays: 5,
      season: 'summer',
    },
    update: { status: 'draft' },
  })

  await prisma.bongCardNewsEpisode.upsert({
    where: { id: EPISODE_ID },
    create: {
      id: EPISODE_ID,
      seriesId: SERIES_ID,
      episodeNumber: 1,
      episodeType: 'package',
      formatType: 'deep',
      title: '몽골 테를지',
      targetCity: '울란바토르',
      targetPlace: '테를지',
    },
    update: { status: 'draft' },
  })

  // 운영자 컨텍스트 (선택) — 카피 반영 확인용
  await prisma.bongMarketingContext.upsert({
    where: { weekKey: WEEK_KEY },
    create: {
      weekKey: WEEK_KEY,
      themeIntent: '도심 밖 초원의 밤하늘을 보여주는 한 편',
      targetAudience: '2030 자연·별 사진 좋아하는 여행자',
      hotInfo: '8월 말 별이 가장 잘 보이는 시기',
      avoidTone: '오글거리는 감탄사 남발',
      customKeywords: '게르, 은하수, 초원',
    },
    update: {},
  })

  // 후킹 라이브러리 few-shot 샘플 (없으면 빈 채로 동작하지만, 톤 확인용 최소 시드)
  const hookCount = await prisma.bongHookLibrary.count()
  if (hookCount === 0) {
    await prisma.bongHookLibrary.createMany({
      data: [
        { hookType: 'good', hookText: '이 풍경은 지도 앱에 안 나와요', context: '의외성', tags: [] },
        { hookType: 'good', hookText: '밤 9시, 도시의 불빛이 사라지는 곳', context: '장면', tags: [] },
        { hookType: 'bad', hookText: '여러분 안녕하세요! 오늘은', context: 'AI 클리셰', tags: [] },
        { hookType: 'bad', hookText: '몽골 여행의 모든 것 완벽 정리', context: '과장', tags: [] },
      ],
    })
  }
}

async function main() {
  const cleanup = process.argv.includes('--cleanup')
  console.log('[PR2-IT] seeding…')
  await seed()

  console.log('[PR2-IT] generating episode via Gemini…')
  const t0 = Date.now()
  const result = await generateCardNewsEpisode(EPISODE_ID)
  console.log(`[PR2-IT] generated in ${Date.now() - t0}ms`)

  const slides = await prisma.bongCardNewsSlide.findMany({
    where: { episodeId: EPISODE_ID },
    orderBy: { slideNumber: 'asc' },
  })
  const episode = await prisma.bongCardNewsEpisode.findUnique({
    where: { id: EPISODE_ID },
    select: { status: true },
  })

  console.log('\n========== RESULT ==========')
  console.log('episode.status =', episode?.status)
  console.log('slide rows =', slides.length)
  for (const s of slides) {
    console.log(`\n[${s.slideNumber}] role=${s.slideRole}`)
    console.log('  headline :', s.headline)
    console.log('  subtitle :', s.subtitle ?? '')
    console.log('  body     :', s.body ?? '')
    console.log('  pexels   :', s.pexelsKeyword ?? '')
  }
  console.log('\n========== JSON ==========')
  console.log(JSON.stringify({ episodeId: result.episodeId, slideCount: slides.length, slides }, null, 2))

  if (cleanup) {
    await prisma.bongCardNewsSeries.delete({ where: { id: SERIES_ID } })
    console.log('\n[PR2-IT] cleaned up test series (cascade).')
  } else {
    console.log('\n[PR2-IT] test data kept (run with --cleanup to remove).')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('[PR2-IT] FAILED:', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
