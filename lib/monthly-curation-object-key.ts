import { buildMonthlyCurationObjectKey } from '@/lib/object-storage'

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .slice(0, 80)
}

/** 서버 업로드·signed 직접 업로드 공통 — `monthly-curation/…webp` 키 */
export function buildMonthlyCurationWebpObjectKey(opts: { monthKey: string; title: string }): string {
  const filename = `${slug(opts.monthKey || 'month')}-${slug(opts.title || 'curation')}-${Date.now()}.webp`
  return buildMonthlyCurationObjectKey(filename)
}
