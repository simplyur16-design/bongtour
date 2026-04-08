import { PrismaClient } from '../prisma-gen-runtime'

/**
 * Prisma runtime policy (BongTour):
 * - Direct DB connection only (SQLite — `prisma/schema.prisma` → `env("DATABASE_URL")`).
 * - Do NOT use Accelerate/Data Proxy client mode here.
 *
 * 왜 `../prisma-gen-runtime` 직접 import?
 * - `generator output = "../prisma-gen-runtime"` 로 생성된 클라이언트를 **항상** 이 경로에서 로드한다.
 * - `next.config.js` 서버 webpack alias(`@prisma/client` → prisma-gen-runtime)와 `tsconfig` paths와
 *   동일 목적이지만, 공용 진입점은 alias 해석에 덜 의존하게 둔다.
 *
 * `new PrismaClient()` (인자 없음):
 * - 스키마의 datasource URL은 런타임 `process.env.DATABASE_URL`에서 읽힌다(Prisma 기본 동작).
 * - 예전에 쓰던 `datasourceUrl: …` 명시 오버라이드는 env와 중복이며, P6001/`prisma://` 류 문제의 근본
 *   해결책이 되지 않는다 — 환경·generate·엔진 정합성이 우선이다.
 *
 * 빈 DATABASE_URL 은 Prisma 내부에서 `prisma://` 관련 오류처럼 보이는 메시지를 낼 수 있어, 여기서 먼저 막는다.
 * Regenerate: `npx prisma generate`. 변경 후 `next dev` 재시작 권장.
 */
function assertDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL
  if (raw == null || String(raw).trim() === '') {
    throw new Error(
      '[prisma] DATABASE_URL 이 설정되지 않았습니다. 프로젝트 루트에 `.env.local` 을 만들고 `DATABASE_URL="file:./dev.db"` 를 넣으세요. 자세한 예는 `.env.example` 참고.'
    )
  }
}

assertDatabaseUrl()

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
