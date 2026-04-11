/**
 * UTF-8 바이트열이 ISO-8859-1(latin1) 문자로 잘못 해석된 뒤 JS 문자열로 들어온 경우의 복구.
 * (한글·상태 문구가 `ì`, `å` 류로 깨질 때 — DB/터미널/클라이언트 인코딩 불일치)
 */
export function repairUtf8MisreadAsLatin1(input: string): string {
  if (!input) return input
  try {
    const out = Buffer.from(input, 'latin1').toString('utf8')
    if (out.includes('\ufffd')) return input
    const syllIn = (input.match(/[\uac00-\ud7a3]/g) || []).length
    const syllOut = (out.match(/[\uac00-\ud7a3]/g) || []).length
    if (syllOut > syllIn) return out
    if (syllIn === 0 && syllOut >= 1) return out
    return input
  } catch {
    return input
  }
}
