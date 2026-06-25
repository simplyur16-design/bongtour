/**
 * `next build` SSG — Docker·CI 이미지 빌드 시 Supabase session pool(보통 15) 초과 방지.
 * 빌드 단계는 DB 미조회(정적·빈 폴백), 런타임 ISR(revalidate)에서 실데이터 로드.
 * REGRESSION-FREEZE[build-ssg-skip-db]: next build Prisma pool 초과 방지 — manifest
 */
export function shouldSkipDbAtBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}
