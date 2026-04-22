# Phase A 결과

## 실행 환경

- 브랜치: `feat/postgres-migration-20260422`
- 커밋: `283b243` 기반 (실측 `HEAD` = `283b243b328b65965801bece42c006d488608614`)
- 사본 파일: `prisma/schema.postgres.prisma`
- 원본 `prisma/schema.prisma`: **변경 없음** (`provider = "sqlite"` 유지)

## validate 결과

### 최초 실행 (`npx prisma validate --schema=prisma/schema.postgres.prisma`, 기본 환경)

- **에러:** 1건 (`P1012`)
- **Warning:** 0건

```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.postgres.prisma
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`.
  -->  prisma\schema.postgres.prisma:27
   |
26 |   provider = "postgresql"
27 |   url      = env("DATABASE_URL")
   |

Validation Error Count: 1
[Context: getConfig]

Prisma CLI Version : 5.22.0
```

**원인:** 루트 `.env`의 `DATABASE_URL`이 SQLite용 `file:…` 이라, `provider = "postgresql"` 과 함께 쓸 수 없음. (`.env.local` 은 수정하지 않음.)

### 최종 실행 (동일 명령, **해당 셸에서만** `DATABASE_URL` 을 `postgresql://…` 로 덮어쓴 뒤)

- **에러:** 0건
- **Warning:** 0건

```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.postgres.prisma
The schema at prisma\schema.postgres.prisma is valid 🚀
```

## 수정 내역

| 구분 | 내용 |
|------|------|
| `schema.postgres.prisma` | `datasource db` 의 `provider` 만 `"sqlite"` → `"postgresql"` 로 1줄 변경 |
| 스키마 필드 (`@db.*`, `Json`, `@default` 등) | **수정 없음** — Case C 의 Type A/B/C 수준의 스키마 오류는 발생하지 않음 |
| 환경 파일 | **수정 없음** — validate 통과를 위해 **명령 실행 시에만** `DATABASE_URL` 을 PostgreSQL 형식으로 설정 |

## `provider =` 확인 (Select-String)

- `prisma/schema.postgres.prisma`: `generator` 의 `provider = "prisma-client-js"` + `datasource` 의 `provider = "postgresql"`
- `prisma/schema.prisma`: `generator` 의 `provider = "prisma-client-js"` + `datasource` 의 `provider = "sqlite"` (**원본 유지**)

## 원본과의 diff 요약

`git diff --no-index prisma/schema.prisma prisma/schema.postgres.prisma` 상위 (일부):

```
diff --git a/prisma/schema.prisma b/prisma/schema.postgres.prisma
index 1e7eb8b..9e8f1e7 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.postgres.prisma
@@ -23,7 +23,7 @@ generator client {
 }
 
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

## Phase B 진입 가능 여부

- [x] 가능 — **스키마 자체는 PostgreSQL provider 기준으로 valid**
- [ ] 추가 검토 필요 — 로컬에서 `validate` 할 때는 **루트 `.env` 의 `DATABASE_URL` 이 `postgresql://` 또는 `postgres://` 로 해석**되어야 함 (또는 validate 전용 셸에서 `DATABASE_URL` 덮어쓰기). `.env.local` 을 바꾸지 않는 전제라면, **Phase B/C 에서 사용할 URL** 을 CI·로컬 스크립트에서 어떻게 줄지만 정하면 됨.
