/**
 * `next build` SSG — CI·Docker 이미지 빌드 시 DB/Supabase pooler에 접속하지 못하는 경우가 많다.
 * sitemap·이미지 sitemap은 빌드 시 정적 URL만 두고, 런타임(revalidate)에 DB를 조회한다.
 */
export function shouldSkipSitemapDbAtBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}
