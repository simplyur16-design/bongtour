/**
 * 월별 큐레이션 샘플 시드 (P5).
 * 이미 published 행이 1건 이상 있으면 종료합니다.
 *
 * 실행: npx tsx scripts/seed-monthly-curations.ts
 */
import { prisma } from '../lib/prisma'

async function main() {
  const existing = await prisma.monthlyCurationItem.count({
    where: { status: 'published' },
  })
  if (existing > 0) {
    console.log(`[seed-monthly-curations] published 항목 ${existing}건 존재 → 스킵`)
    return
  }

  const data = [
    {
      yearMonth: '2026-04',
      scope: 'domestic',
      destinationName: '제주',
      oneLineTheme: '봄 햇살·노을 드라이브',
      whyNowText: '4~5월 기온이 안정적이고 렌터카·숙소 선택지가 넓습니다.',
      recommendedForText: '가족·커플, 짧은 휴가로 재충전하고 싶은 분',
      leadTimeLabel: '성수기 전 주말은 3~4주 전 상담을 권장합니다.',
      primaryInquiryType: 'travel_consult',
      briefingSourceType: 'bongtour_editorial',
      sortOrder: 0,
      status: 'published',
      isActive: true,
    },
    {
      yearMonth: '2026-04',
      scope: 'domestic',
      destinationName: '부산·경주',
      oneLineTheme: '바다와 역사 3박 4일',
      whyNowText: '국내 단거리 이동 위주로 일정 설계가 유연합니다.',
      recommendedForText: '첫 가족여행·어르신 동반',
      leadTimeLabel: '주말 숙소는 2~3주 전부터 촉박해질 수 있습니다.',
      primaryInquiryType: 'travel_consult',
      briefingSourceType: 'hybrid',
      sortOrder: 1,
      status: 'published',
      isActive: true,
    },
    {
      yearMonth: '2026-05',
      scope: 'domestic',
      destinationName: '강원',
      oneLineTheme: '산림·웰니스 프로그램',
      whyNowText: '단체 일정은 기관 일정에 맞춰 견적이 달라집니다.',
      recommendedForText: '학교·기관 단체, 워크숍 견적이 필요한 담당자',
      leadTimeLabel: '단체는 최소 4~6주 전 상담을 권장합니다.',
      primaryInquiryType: 'institution_request',
      briefingSourceType: 'bongtour_editorial',
      sortOrder: 0,
      status: 'published',
      isActive: true,
    },
    {
      yearMonth: '2026-04',
      scope: 'overseas',
      destinationName: '다낭',
      oneLineTheme: '해변 리조트와 시내 맛집',
      whyNowText: '직항·환승 옵션을 비교해 일정을 맞추기 좋은 시즌입니다.',
      recommendedForText: '휴양 위주, 가족·친구 동반',
      leadTimeLabel: '성수기 좌석·요금 변동이 잦아 4주 전 상담을 권장합니다.',
      primaryInquiryType: 'travel_consult',
      briefingSourceType: 'supplier_based',
      sortOrder: 0,
      status: 'published',
      isActive: true,
    },
    {
      yearMonth: '2026-05',
      scope: 'overseas',
      destinationName: '도쿄',
      oneLineTheme: '기업 벤치마킹·연수 일정',
      whyNowText: '방문 기관·일정에 따라 견적과 서류가 달라집니다.',
      recommendedForText: '기업·기관 연수 담당자',
      leadTimeLabel: '비자·기관 섭외가 필요하면 8주 이상 여유를 권장합니다.',
      primaryInquiryType: 'overseas_training_quote',
      briefingSourceType: 'hybrid',
      sortOrder: 0,
      status: 'published',
      isActive: true,
    },
    {
      yearMonth: '2026-06',
      scope: 'overseas',
      destinationName: '인천 ↔ 공항 연계',
      oneLineTheme: '단체 항공 일정에 맞춘 차량',
      whyNowText: '항공·단체 인원에 맞춰 차량 규격과 시간을 맞춥니다.',
      recommendedForText: '학교·기관 단체, 전세 버스가 필요한 일정',
      leadTimeLabel: '출발 3주 전까지 상담 완료를 권장합니다.',
      primaryInquiryType: 'bus_quote',
      briefingSourceType: 'bongtour_editorial',
      sortOrder: 0,
      status: 'published',
      isActive: true,
    },
  ]

  const r = await prisma.monthlyCurationItem.createMany({ data })
  console.log(`[seed-monthly-curations] ${r.count}건 생성`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
