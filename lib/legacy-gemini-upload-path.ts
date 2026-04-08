/**
 * DB에 남아 있는 로컬 전용 경로 `/uploads/gemini/...` — 운영 서버에는 파일이 없을 수 있음.
 */

export function warnLegacyGeminiUploadPath(
  url: string | null | undefined,
  context: string
): void {
  if (process.env.NODE_ENV !== 'production') return
  const u = url?.trim()
  if (u?.startsWith('/uploads/gemini/')) {
    console.warn(`[legacy-gemini-path] ${context}: ${u}`)
  }
}
