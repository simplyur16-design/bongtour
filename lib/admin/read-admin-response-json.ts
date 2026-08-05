/**
 * Admin fetch 응답 파서 — 빈 body / 프록시 타임아웃에서
 * `Unexpected end of JSON input` 대신 한글 메시지를 낸다.
 */
// REGRESSION-FREEZE[admin-empty-json-response]: empty Response.json guard — manifest

export async function readAdminResponseJson<T = any>(res: Response, emptyHint?: string): Promise<T> {
  const raw = await res.text()
  if (!raw.trim()) {
    throw new Error(
      emptyHint?.trim() ||
        `서버 응답이 비었습니다 (${res.status}). 잠시 후 다시 시도하거나 배포·DB 상태를 확인하세요.`,
    )
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`서버 응답을 해석할 수 없습니다 (${res.status}).`)
  }
}

export function adminClientFetchErrorMessage(e: unknown): string {
  if (e instanceof TypeError && /failed to fetch/i.test(e.message)) {
    return '서버에 연결할 수 없습니다. 네트워크·주소(http/https)와 서버 실행 여부를 확인해 주세요.'
  }
  if (e instanceof Error && e.message.trim()) return e.message
  return '요청 중 오류가 발생했습니다.'
}
