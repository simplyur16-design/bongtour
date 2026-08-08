/**
 * Next Data Cache에 빈 결과가 박히면(배포 레이스·DB 순간 실패) ISR이 수십 분 빈 화면을 유지한다.
 * 캐시 hit이 빈 배열이면 한 번 더 uncached로 읽어 복구한다.
 * REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: empty cache bypass — manifest
 */

export async function readCachedArrayOrBypassEmpty<T>(
  readCached: () => Promise<T[]>,
  readFresh: () => Promise<T[]>,
): Promise<T[]> {
  const cached = await readCached()
  if (cached.length > 0) return cached
  return readFresh()
}
