export type YbtourScheduleImageKeywordOpts = {
  productDestination?: string | null
}

export function applyYbtourScheduleImageKeywordsToRows<
  T extends { imageKeyword?: string | null; imageKeyword2?: string | null },
>(rows: T[], _opts?: YbtourScheduleImageKeywordOpts): T[] {
  return rows.map((row) => ({
    ...row,
    imageKeyword: String(row.imageKeyword ?? '').trim(),
    imageKeyword2: row.imageKeyword2 ?? null,
  }))
}
