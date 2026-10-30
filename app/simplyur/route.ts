import { SIMPLYUR_DEFAULT_LOCALE, simplyurPath } from "@/lib/simplyur/constants";

/**
 * `/simplyur` → `/simplyur/en` 진짜 307.
 * page.tsx + redirect()는 루트 app/loading.tsx(Suspense) 안에서 스트리밍되어
 * 200 + `<meta http-equiv="refresh" content="1;url=...">`로 내려가고, 그 1초 동안
 * 루트 기본 제목(Bong투어 | BongTour)이 탭에 보였다. 라우트 핸들러는 레이아웃·loading을 타지 않는다.
 * Location은 상대 경로로 둔다(프록시 뒤 내부 호스트가 새지 않도록). 쿼리(utm 등)는 그대로 넘긴다.
 */
export function GET(request: Request): Response {
  const { search } = new URL(request.url);
  return new Response(null, {
    status: 307,
    headers: {
      Location: `${simplyurPath(SIMPLYUR_DEFAULT_LOCALE)}${search}`,
      "Cache-Control": "no-store",
    },
  });
}

export const HEAD = GET;
