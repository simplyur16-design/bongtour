/**
 * travel_reviews 시드 데이터(배열) 정적 검증 — Supabase 연결 없음.
 *   npm run verify:travel-review-seed
 *
 * DB에서 중복 실행 검증: `npm run seed:travel-reviews` 를 같은 DB에 두 번 실행하면
 * 두 번째는 모두 [update] 경로(행 수 증가 없음)여야 합니다.
 */

import { assertTravelReviewSeedInvariants } from './data/travel-review-seed-data'

assertTravelReviewSeedInvariants()
console.log('[verify-travel-review-seed] OK — 21건 문안·기준일·피처드 6·타입 분포·자연키 유일')
console.log('[verify-travel-review-seed] 힌트: 시드 2회 실행 시 2회차는 insert 0 · update 21 이어야 합니다.')
