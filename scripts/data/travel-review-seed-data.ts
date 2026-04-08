/**
 * public.travel_reviews 관리자용 초기 시드(21건).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 수정 가이드 (운영·문안 손볼 때)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1) 실행: `npm run seed:travel-reviews` (또는 `npx tsx scripts/seed-travel-reviews.ts`)
 * 2) 시드 검증만: `npm run verify:travel-review-seed` (DB 없이 배열·날짜·피처드·자연키 중복 검사)
 * 3) 자주 바꾸는 필드: 각 객체의 title, excerpt, body, customer_type, destination_country/city,
 *    tags, travel_month, displayed_date, rating_label, is_featured, status
 * 4) 자동으로 채워지는 값(직접 안 넣음): category·user_id·source_type·approved_*·published_at·display_order
 *    → `scripts/seed-travel-reviews.ts` 참고
 * 5) 중복 실행: 동일 자연키(title+displayed_date+destination_country+destination_city)면 UPDATE만 함(행 증가 없음)
 * 6) 날짜: travel_month / displayed_date / published_at(스크립트가 published 일 때 부여)은
 *    모두 TRAVEL_REVIEW_LAUNCH_DATE(2025-01-07) 이후여야 함 — DB check 와 동일
 * 7) 피처드 6건: is_featured true + status published 가 정확히 6개이며,
 *    review_type 이 solo / group_small / group_corporate / group_friends / family / parents 각 1건
 *    (hiking 은 피처드 없음)
 * 8) review_type 분포 고정: solo×3, group_small×3, group_corporate×4, group_friends×3,
 *    family×3, parents×3, hiking×2 (=21)
 *
 * 기타: 실제 회원 제출이 아님 → source_type 은 스크립트에서 manual_admin.
 * review_type 은 DB check 와 동일한 enum 만 사용.
 */
import type { ReviewType } from '../../lib/reviews-types'

/** 시드 한 행 — 테이블과 1:1에 가깝게, 편집 구역을 주석으로 구분 */
export type TravelReviewSeedItem = {
  review_type: ReviewType

  /** ✎ 편집: 카드 제목 */
  title: string
  /** ✎ 편집: 카드 요약 */
  excerpt: string
  /** ✎ 편집: 상세·운영 정리용 본문 */
  body: string
  /** ✎ 편집: 화면 표시용 라벨 (자유 텍스트) */
  customer_type: string
  /** ✎ 편집 */
  destination_country: string | null
  /** ✎ 편집 */
  destination_city: string | null
  /** ✎ 편집 */
  tags: string[]
  /** ✎ 편집: YYYY-MM-DD (월만 의미일 때도 해당 월 1일) — 2025-01-07 이후 */
  travel_month: string
  /** ✎ 편집: 노출일 — 2025-01-07 이후, 중복 방지 자연키 일부 */
  displayed_date: string
  /** ✎ 편집 */
  rating_label: string | null

  /** ✎ 편집: 해외 랜딩 대표 노출(최대 6건 true, 스크립트가 display_order 1~6 부여) */
  is_featured: boolean
  /** ✎ 편집: 대부분 published; pending / rejected 예시 포함 */
  status: 'published' | 'pending' | 'rejected'
  /** ✎ 편집: rejected 일 때만 */
  rejection_reason?: string | null
}

/**
 * 21건 분포: solo×3, group_small×3, group_corporate×4, group_friends×3, family×3, parents×3, hiking×2
 * 피처드 6건: solo, group_small, group_corporate, group_friends, family, parents 각 1건
 * 비피처드 중 1건 rejected(group_friends), 1건 pending(parents)
 */
export const TRAVEL_REVIEW_SEED_ITEMS: TravelReviewSeedItem[] = [
  // —— solo ×3 (1건 피처드) ——
  {
    review_type: 'solo',
    title: '첫 유럽 혼행, 비행편만으로도 질문이 많았는데 정리가 잘 됐어요',
    excerpt:
      '직항·경유 비교랑 수하물 규정을 표로 받아서 현장에서 크게 당황하지 않았습니다. 과장 없이 필요한 것만 짚어 주셔서 좋았어요.',
    body:
      '혼자 가는 첫 유럽이라 항공편 고를 때 질문이 많았습니다. 직항과 경유의 대략적인 이동 시간, 수하물 포함 여부, 공항 도착 후 시내까지 대략 거리까지 한 번에 표로 정리해 주셔서 결정이 빨랐어요. 현지에서 실제로 그 동선대로 움직여 보니 설명과 크게 어긋나지 않았고, 앱으로 미리 받아 둔 지도 링크도 도움이 됐습니다. 다음에도 비슷한 스타일로 준비해 보고 싶습니다.',
    customer_type: '단독여행',
    destination_country: '프랑스',
    destination_city: '파리',
    tags: ['일정조율', '상담만족', '자유일정'],
    travel_month: '2025-02-01',
    displayed_date: '2025-02-19',
    rating_label: '전반적으로 만족',
    is_featured: true,
    status: 'published',
  },
  {
    review_type: 'solo',
    title: '야간 도착이라 숙소 체크인 시간을 미리 맞춰 달라고 했더니 반영됐어요',
    excerpt:
      '늦게 도착하는 날은 짐만 빨리 풀고 쉬고 싶었는데, 프론트 운영 시간이랑 연락처를 미리 적어 주셔서 현지에서 연락하기 수월했습니다.',
    body:
      '저녁 늦게 도착하는 일정이라 체크인 가능 시각과 호텔 측에 미리 전달할 요청 문구를 정리해 달라고 했습니다. 안내해 주신 대로 메일 문구를 보내 두었더니 현지에서 큰 문제 없이 방 배정이 됐고, 엘리베이터 위치까지 간단히 적어 주신 덕분에 피곤한 날에 동선이 짧았습니다. 다음 여행 때도 비슷한 식으로 미리 정리해 두는 편이 좋겠다고 느꼈습니다.',
    customer_type: '단독여행',
    destination_country: '이탈리아',
    destination_city: '로마',
    tags: ['숙소만족', '이동편함'],
    travel_month: '2025-04-01',
    displayed_date: '2025-04-23',
    rating_label: '재방문 의사 있음',
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'solo',
    title: '환승 시간 짧을 때 보험·대안 루트를 같이 짚어 주셨어요',
    excerpt:
      '최소 환승 시간이 빡빡한 편이었는데, 지연 시 대안이 되는 다음 편과 공항 내 동선을 텍스트로 정리해 주셔서 마음이 덜 불안했습니다.',
    body:
      '환승이 한 시간대 초반이라 걱정이 많았습니다. 항공사별 최소 체류 시간 안내와, 만약 첫 편이 늦을 경우 대략 어떤 선택지가 있는지 텍스트로 정리해 주셔서 현지에서 판단하기가 쉬웠어요. 실제로는 정시에 도착해서 그대로 탔지만, 미리 시뮬레이션해 둔 느낌이라 여유가 있었습니다. 혼자 갈 때는 이런 식의 체크리스트가 특히 도움이 됩니다.',
    customer_type: '단독여행',
    destination_country: '네덜란드',
    destination_city: '암스테르담',
    tags: ['항공', '일정구성'],
    travel_month: '2025-08-01',
    displayed_date: '2025-08-27',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },

  // —— group_small ×3 (1건 피처드) ——
  {
    review_type: 'group_small',
    title: '여덟 명이라 집결만 맞추면 됐고, 장소 사진이랑 지도가 한 묶음이었어요',
    excerpt:
      '미팅 포인트 사진과 지도 링크를 묶어 보내 주셔서 현지에서 찾기 쉬웠습니다. 자유시간 안내가 과하지 않아 부담이 적었어요.',
    body:
      '친지 모임 여덟 명이서 갔는데, 연령대가 갈려 있어 집결이 제일 걱정이었습니다. 미팅 장소 사진과 지도, 현지에서 쓸 짧은 문구까지 한 묶음으로 보내 주셔서 현지에서 헤매지 않았어요. 자유시간에는 각자 쉴 수 있게 큰 틀만 잡혀 있어서 부담이 없었고, 문제 생기면 연락 채널이 명확해서 조율이 빨랐습니다. 다음에도 비슷한 규모로 가면 같은 방식이 좋겠다고 느ꁼ니께요.',
    customer_type: '소규모단체',
    destination_country: '베트남',
    destination_city: '다낭',
    tags: ['소규모모임', '집결', '이동동선좋음'],
    travel_month: '2025-03-01',
    displayed_date: '2025-03-16',
    rating_label: '응대 만족',
    is_featured: true,
    status: 'published',
  },
  {
    review_type: 'group_small',
    title: '인원 한 명 빠졌을 때 객실·비용 차이를 표로 보내 주셨어요',
    excerpt:
      '출발 한 달 전 인원 변동이 있었는데, 객실 배정과 비용 차이를 표로 정리해 주셔서 단톡에서 합의가 빨랐습니다.',
    body:
      '갑자기 한 분이 일정상 빠지게 되면서 방 배정과 비용을 다시 맞춰야 했습니다. 변경 전후로 객실 타입과 대략적인 차액을 표로 보내 주셔서 단톡방에서 숫자 근거가 명확했어요. 현지에서 체크인할 때도 혼선 없이 처리됐고, 영수증 관련 문의에도 빠르게 답 주셨습니다.',
    customer_type: '지인 8인 모임여행',
    destination_country: '일본',
    destination_city: '후쿠오카',
    tags: ['단체진행', '상담만족'],
    travel_month: '2025-06-01',
    displayed_date: '2025-06-24',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'group_small',
    title: '식사 제한 있는 분 계셔서 미리 전달했더니 일정표에 반영됐다고 해 주셨어요',
    excerpt:
      '채식 위주 식사가 필요한 분이 계셔서 가능한 날짜를 알려 드렸더니, 현지 일정 설명에 참고 문구가 들어갔다고 안내 받았습니다.',
    body:
      '소규모라 식사 취향이 다양했는데, 채식 위주로 가능한 날을 미리 알려 드렸습니다. 현지 일정 설명에 간단한 참고 문구가 반영됐다고 해서 현지 가이드와 소통할 때 덜 애매했어요. 완벽히 맞춤은 아니어도 “미리 말했다”는 근거가 있어서 분위기가 덜 어색했습니다.',
    customer_type: '소규모단체',
    destination_country: '대만',
    destination_city: '타이베이',
    tags: ['식사무난', '일정조율'],
    travel_month: '2025-10-01',
    displayed_date: '2025-10-21',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },

  // —— group_corporate ×4 (1건 피처드) ——
  {
    review_type: 'group_corporate',
    title: '워크숍 블록이랑 이동 시간이 하루 단위 표로 정리돼 있었습니다',
    excerpt:
      '회의·워크숍·간단 관광이 섞인 일정인데, 하루별로 시간 블록이 표로 와서 임원 일정 조율이 수월했습니다.',
    body:
      '사내 워크숍과 현지 미팅이 겹치는 일정이라 시간 배분이 중요했습니다. 하루별로 회의 블록, 이동, 식사, 짧은 관광이 표로 정리돼 있어서 경영진 일정을 맞추기 쉬웠어요. 현지에서 예상보다 길어진 회의가 있을 때도 대체 동선을 문자로 짧게 안내해 주셔서 흐름이 끊기지 않았습니다.',
    customer_type: '기업단체',
    destination_country: '태국',
    destination_city: '방콕',
    tags: ['워크숍', '기업행사', '단체이동'],
    travel_month: '2025-05-01',
    displayed_date: '2025-05-18',
    rating_label: '만족',
    is_featured: true,
    status: 'published',
  },
  {
    review_type: 'group_corporate',
    title: '임원 도착 시각이 바뀌어도 픽업 재확인 문자 흐름이 명확했어요',
    excerpt:
      '마지막 주에 공항 도착 시각이 바뀌었는데, 픽업 재확인과 차량 연락처가 한 메시지에 정리돼 와서 현지에서 혼선이 없었습니다.',
    body:
      '임원 일정 때문에 공항 도착이 늦춰졌을 때가 있었는데, 픽업 업체와의 재확인 문구가 한 번에 정리돼 있어서 전달하기 편했습니다. 현지에서 기사님과 통화할 때도 번호와 짧은 영어 문장이 있어서 커뮤니케이션이 수월했어요.',
    customer_type: '사내 워크숍 단체',
    destination_country: '싱가포르',
    destination_city: null,
    tags: ['단체이동', '가이드응대'],
    travel_month: '2025-07-01',
    displayed_date: '2025-07-26',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'group_corporate',
    title: '견적과 실제 청구 항목이 항목별로 맞는지 미리 짚어 주셨어요',
    excerpt:
      '단체 견적이라 부가 항목이 많았는데, 포함·불포함을 항목별로 정리해 주셔서 내부 결재할 때 설명이 쉬웠습니다.',
    body:
      '회사 규모 일정이라 견적서 항목이 많았습니다. 포함·불포함·현지에서 현금이 필요한 부분을 구분해 주셔서 재무 쪽에 설명하기 좋았어요. 현지에서 추가 비용이 나올 만한 지점도 미리 짚어 주셔서 현장에서 논쟁이 줄었습니다.',
    customer_type: '기업단체',
    destination_country: '말레이시아',
    destination_city: '쿠알라룸푸르',
    tags: ['기업행사', '상담만족'],
    travel_month: '2025-09-01',
    displayed_date: '2025-09-17',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'group_corporate',
    title: '팀 빌딩 일정이랑 자유 시간의 균형이 현실적이었습니다',
    excerpt:
      '너무 빡빡하지 않게 팀 활동과 자유 시간이 나뉘어 있어서 참가자 반응이 좋았습니다. 난이도 높은 활동은 선택으로 안내해 주셨어요.',
    body:
      '팀 빌딩 성격의 출장이었는데, 필수 일정과 선택 일정이 나뉘어 있어 부담이 적었습니다. 체력이 약한 직원도 있어서 무리한 활동은 빼고 대안을 제시해 주셨고, 자유 시간에는 각자 쉴 수 있게 안내만 남겨 두는 식이라 만족도가 괜찮았습니다.',
    customer_type: '기업단체',
    destination_country: '필리핀',
    destination_city: '세부',
    tags: ['단체진행', '자유시간'],
    travel_month: '2025-11-01',
    displayed_date: '2025-11-28',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },

  // —— group_friends ×3 (1건 피처드, 1건 rejected) ——
  {
    review_type: 'group_friends',
    title: '친구 여섯이서 가도 집결 시간만 맞추면 됐어요',
    excerpt:
      '야경 보러 갈 때 택시 앱이랑 대략 요금대를 미리 알려 주셔서 현지에서 싸우지 않고 탔습니다.',
    body:
      '친구 여섯 명이서 갔는데 각자 성향이 달라도 집결 시간만 지키면 됐습니다. 밤에 야경 보러 갈 때는 택시 앱 이름이랑 대략 요금대를 미리 알려 주셔서 현지에서 분위기 안 나빠졌어요. 자유시간에는 각자 돌아다녀도 되게 큰 틀만 잡혀 있어서 부담이 적었습니다.',
    customer_type: '친구모임',
    destination_country: '일본',
    destination_city: '오사카',
    tags: ['친구모임', '이동편함', '자유시간'],
    travel_month: '2025-04-01',
    displayed_date: '2025-04-12',
    rating_label: '또 가고 싶음',
    is_featured: true,
    status: 'published',
  },
  {
    review_type: 'group_friends',
    title: '비 온 날 실내 대안 리스트가 짧게라도 있어서 좋았어요',
    excerpt:
      '우천 시 갈 만한 실내 코스를 세 군데 정도 텍스트로 받아서 당일에 골라 갔습니다. 과하지 않은 분량이었어요.',
    body:
      '날씨가 애매한 날이 있어서 실내 대안이 있으면 좋겠다고 했더니, 세 군데 정도 짧게 정리해 주셨습니다. 현지에서 날씨 보고 골라 갔는데 줄이 너무 길면 패스하기 쉬웠어요. 친구들이랑 가볍게 정하기 좋았습니다. 해외 소도시라 우천 시 대안이 있으면 마음이 편했어요.',
    customer_type: '친구 6인 소규모모임',
    destination_country: '일본',
    destination_city: '오키나와',
    tags: ['친구모임', '일정구성'],
    travel_month: '2025-12-01',
    displayed_date: '2025-12-15',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'group_friends',
    title: '요청한 문구와 실제 상품 안내가 달라 공개가 어려웠습니다',
    excerpt:
      '내부 검수 기준에 따라 반려된 예시입니다. 실제 운영에서는 사유를 구체히 남깁니다.',
    body:
      '문의 당시 안내받은 조건과 확정된 상품 설명의 일부가 달라져 재확인을 요청드렸습니다. 검수 과정에서 공개가 어렵다는 판단을 받았고, 사유는 기록으로 남겼습니다. 이후 수정 안내를 받으면 다시 제출할 예정입니다.',
    customer_type: '친구모임',
    destination_country: '몰디브',
    destination_city: null,
    tags: ['친구모임'],
    travel_month: '2025-08-01',
    displayed_date: '2025-08-09',
    rating_label: null,
    is_featured: false,
    status: 'rejected',
    rejection_reason: '상품 설명과 제출 내용 불일치 — 재확인 후 재제출 안내',
  },

  // —— family ×3 (1건 피처드) ——
  {
    review_type: 'family',
    title: '아이 낮잠 시간 맞추려고 이동 간격 조정해 주셨어요',
    excerpt:
      '초등 아이 한 명 있는 가족인데, 점심 후 이동을 짧게 가져가 달라고 했더니 일정표가 현실적으로 바뀌었습니다.',
    body:
      '아이가 낮잠이 있는 편이라 점심 후 긴 이동은 피하고 싶었습니다. 요청을 전달해 주셔서 일정표에서 이동 구간이 짧게 조정됐고, 현지에서도 크게 무리하지 않았어요. 병원·약국 정보는 희망만 말했는데 과하게 권하지 않아서 좋았습니다.',
    customer_type: '가족여행',
    destination_country: '괌',
    destination_city: null,
    tags: ['가족맞춤', '자유시간', '일정조율'],
    travel_month: '2025-06-01',
    displayed_date: '2025-06-29',
    rating_label: '가족 모두 무난',
    is_featured: true,
    status: 'published',
  },
  {
    review_type: 'family',
    title: '놀이공원 대기 시간 언급이 있어서 기대치가 맞았어요',
    excerpt:
      '현지 놀이 시설은 줄이 길 수 있다는 문구가 미리 있어서 아이랑 싸우지 않고 기다렸습니다.',
    body:
      '테마파크 일정이 있었는데, 대기가 길 수 있다는 안내가 미리 있어서 마음의 준비가 됐습니다. 실제로 길었지만 미리 각오가 돼 있어서 덜 스트레스였어요. 가족 단위로 쉴 타임도 일정에 조금씩 있어서 괜찮았습니다.',
    customer_type: '가족여행',
    destination_country: '일본',
    destination_city: '도쿄',
    tags: ['가족맞춤', '일정구성'],
    travel_month: '2025-10-01',
    displayed_date: '2025-10-30',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'family',
    title: '큰애·작은애 취향이 달라도 하루는 각자 쉬는 식으로 나눠졌어요',
    excerpt:
      '한 날은 부모만 짧게 관광하고 아이는 호텔에서 쉬는 식으로 일정을 나눠 달라고 했더니 반영됐습니다.',
    body:
      '형제 나이 차이가 있어서 하루는 부모만 짧게 나가고 아이는 수영장에서 쉬게 하고 싶었습니다. 일정 설명에 그렇게 반영돼 있어서 현지에서 설득이 쉬웠어요. 완벽하진 않아도 가족 간 타협이 덜 힘들었습니다.',
    customer_type: '가족여행',
    destination_country: '호주',
    destination_city: '골드코스트',
    tags: ['가족맞춤', '자유시간'],
    travel_month: '2026-01-01',
    displayed_date: '2026-01-22',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },

  // —— parents ×3 (1건 피처드, 1건 pending) ——
  {
    review_type: 'parents',
    title: '부모님 걸음이 느려도 무리 없는 동선이었어요',
    excerpt:
      '엘리베이터·짧은 도보 위주로 바꿔 달라고 했더니 호텔 후보 비교까지 해 주셨습니다.',
    body:
      '부모님 동반 여행이라 계단이 많은 동선은 피하고 싶었습니다. 엘리베이터 사용이 수월한 호텔 후보를 비교해 주셔서 선택이 쉬웠고, 관광지도 도보 거리가 짧은 쪽으로 조정됐습니다. 식사는 한식 가능한 날을 넣어 달라고 했더니 반영됐어요.',
    customer_type: '부모님동반 가족여행',
    destination_country: '스페인',
    destination_city: '바르셀로나',
    tags: ['부모님동반', '어르신배려', '이동동선좋음'],
    travel_month: '2025-05-01',
    displayed_date: '2025-05-11',
    rating_label: '부모님도 만족',
    is_featured: true,
    status: 'published',
  },
  {
    review_type: 'parents',
    title: '복약 시간 표시를 일정표에 넣어 달라고 했더니 작게라도 찍혀 왔어요',
    excerpt:
      '세부 사항을 챙기는 스타일이라 미리 말씀드렸더니 체크리스트처럼 정리돼 있었습니다.',
    body:
      '부모님 약 복용 시간이 정해져 있어서 일정표에 작게라도 표시해 달라고 했습니다. 반영돼 있어서 현지에서 놓치지 않았고, 식사 시간 조율할 때도 참고가 됐습니다. 과하지 않게만 표시해 주셔서 보기에도 부담이 없었어요.',
    customer_type: '부모님동반',
    destination_country: '포르투갈',
    destination_city: '리스본',
    tags: ['어르신배려', '상담만족'],
    travel_month: '2025-09-01',
    displayed_date: '2025-09-26',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'parents',
    title: '검수 전 초안입니다 — 동행 인원 확정 후 본문을 다듬을 예정입니다',
    excerpt:
      '관리자 검토 대기 중인 예시 행입니다. 노출은 승인 후에만 됩니다.',
    body:
      '부모님과 형제 가족이 함께 가는 일정이라 인원과 방 배정이 아직 확정 단계입니다. 확정되는 대로 이동 동선과 식사 일정을 구체화해 다시 제출할 예정입니다. 현재 본문은 초안입니다.',
    customer_type: '부모님동반',
    destination_country: '스위스',
    destination_city: '인터라켄',
    tags: ['부모님동반'],
    travel_month: '2026-03-01',
    displayed_date: '2026-03-08',
    rating_label: null,
    is_featured: false,
    status: 'pending',
  },

  // —— hiking ×2 (피처드 없음) ——
  {
    review_type: 'hiking',
    title: '일출 코스 직전 숙소 거리가 짧게 잡혀 있어서 새벽이 덜 힘들었어요',
    excerpt:
      '등산화·스틱 수하물 규정을 항공사별로 짚어 주셔서 공항에서 걸리지 않았습니다.',
    body:
      '일출을 보러 새벽에 움직이는 날이 있어서 전날 숙소 거리가 중요했습니다. 도보로 접근 가능한 쪽으로 잡혀 있어서 피곤함이 덜했고, 등산화와 스틱 수하물 규정을 항공사별로 정리해 주셔서 체크인 때 문제가 없었습니다. 난이도 표현이 과하지 않아 체력 맞추기가 쉬웠어요.',
    customer_type: '산악회여행',
    destination_country: '네팔',
    destination_city: '포카라',
    tags: ['일정구성', '이동편함', '재방문의사'],
    travel_month: '2025-07-01',
    displayed_date: '2025-07-19',
    rating_label: '회원들 반응 좋음',
    is_featured: false,
    status: 'published',
  },
  {
    review_type: 'hiking',
    title: '우천 시 플랜 B가 숫자로 정리돼 있어서 당일이 덜 당황스러웠습니다',
    excerpt:
      '코스 단축 시 입장료·이동 시간을 대략 적어 주셔서 현장에서 선택이 빨랐어요.',
    body:
      '산악 코스는 날씨 영향이 커서 우천 시 플랜 B를 미리 받아 두었습니다. 코스 단축 시 입장료와 이동 시간이 대략 숫자로 적혀 있어서 당일에 회원들에게 설명하기 쉬웠습니다. 안전 쪽 안내도 짧게 정리돼 있어서 무리하게 가지 않기 좋았습니다. 해외 산행이라 통역·이동 구간도 미리 짚어 주신 덕분에 현장에서 설득이 덜 어려웠어요.',
    customer_type: '산악회여행',
    destination_country: '대만',
    destination_city: '화련',
    tags: ['일정조율', '가이드응대'],
    travel_month: '2026-02-01',
    displayed_date: '2026-02-11',
    rating_label: null,
    is_featured: false,
    status: 'published',
  },
]

/** DB `travel_reviews_*_after_launch` check 와 동일한 문자열 기준일 */
export const TRAVEL_REVIEW_LAUNCH_DATE = '2025-01-07' as const

const REVIEW_TYPE_EXPECTED_COUNTS: Record<ReviewType, number> = {
  solo: 3,
  group_small: 3,
  group_corporate: 4,
  group_friends: 3,
  family: 3,
  parents: 3,
  hiking: 2,
}

const FEATURED_REVIEW_TYPES: ReviewType[] = [
  'solo',
  'group_small',
  'group_corporate',
  'group_friends',
  'family',
  'parents',
]

function seedNaturalKey(item: TravelReviewSeedItem): string {
  const title = item.title.trim()
  const d = item.displayed_date.trim().slice(0, 10)
  const c = item.destination_country?.trim() ?? ''
  const city = item.destination_city?.trim() ?? ''
  return `${title}|${d}|${c}|${city}`
}

/** 시드 배열·문안·날짜·피처드·분포·자연키 유일성 검사. DB 연결 없음. */
export function assertTravelReviewSeedInvariants(): void {
  const items = TRAVEL_REVIEW_SEED_ITEMS
  const err = (msg: string) => {
    throw new Error(`[travel-review-seed-data] ${msg}`)
  }

  if (items.length !== 21) {
    err(`건수는 21이어야 합니다 (현재 ${items.length})`)
  }

  const seenNat = new Set<string>()
  const typeCounts: Record<ReviewType, number> = {
    solo: 0,
    group_small: 0,
    group_corporate: 0,
    group_friends: 0,
    family: 0,
    parents: 0,
    hiking: 0,
  }

  for (const item of items) {
    const nk = seedNaturalKey(item)
    if (seenNat.has(nk)) err(`자연키 중복: ${nk.slice(0, 80)}…`)
    seenNat.add(nk)

    if (!item.title.trim()) err('빈 title 이 있습니다.')
    if (!item.excerpt.trim()) err('빈 excerpt 가 있습니다.')
    if (!item.body.trim()) err('빈 body 가 있습니다.')

    const tm = item.travel_month.trim().slice(0, 10)
    const dd = item.displayed_date.trim().slice(0, 10)
    if (tm < TRAVEL_REVIEW_LAUNCH_DATE) err(`travel_month 가 기준일 이전: ${tm}`)
    if (dd < TRAVEL_REVIEW_LAUNCH_DATE) err(`displayed_date 가 기준일 이전: ${dd}`)

    if (item.status === 'published') {
      const publishedAtDay = `${dd}T12:00:00.000Z`.slice(0, 10)
      if (publishedAtDay < TRAVEL_REVIEW_LAUNCH_DATE) {
        err(`published_at(유도) 가 기준일 이전: ${publishedAtDay}`)
      }
    }
    if (item.status === 'pending' || item.status === 'rejected') {
      // published_at 은 null — 검증 생략
    }

    typeCounts[item.review_type]++
  }

  for (const t of Object.keys(REVIEW_TYPE_EXPECTED_COUNTS) as ReviewType[]) {
    if (typeCounts[t] !== REVIEW_TYPE_EXPECTED_COUNTS[t]) {
      err(`review_type ${t} 개수 불일치: 기대 ${REVIEW_TYPE_EXPECTED_COUNTS[t]}, 실제 ${typeCounts[t]}`)
    }
  }

  const featuredPublished = items.filter((i) => i.is_featured && i.status === 'published')
  if (featuredPublished.length !== 6) {
    err(`피처드+published 는 6건이어야 합니다 (현재 ${featuredPublished.length})`)
  }

  const featuredTypes = new Set(featuredPublished.map((i) => i.review_type))
  for (const t of FEATURED_REVIEW_TYPES) {
    if (!featuredTypes.has(t)) err(`피처드에 ${t} 타입 1건이 없습니다.`)
  }
  if (featuredTypes.has('hiking')) err('hiking 은 피처드에 넣지 않습니다.')

  for (const i of featuredPublished) {
    if (!FEATURED_REVIEW_TYPES.includes(i.review_type)) {
      err(`허용되지 않은 피처드 review_type: ${i.review_type}`)
    }
  }
}
