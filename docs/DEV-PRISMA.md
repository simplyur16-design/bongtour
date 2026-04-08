# Prisma 로컬 개발

## Windows `EPERM` (query_engine-windows.dll.node)

`npx prisma generate`가 실패하며 `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`가 나오면, Windows에서 Prisma 쿼리 엔진 DLL이 다른 프로세스에 잠겨 rename이 막힌 경우가 많습니다.

## 권장 순서

1. `next dev` 등 **개발 서버 종료**
2. 불필요한 **node 프로세스** 종료(또는 IDE/에이전트가 해당 폴더의 Prisma 런타임을 붙잡은 경우 잠시 대기)
3. `npx prisma generate` (또는 `npm run prisma:generate:safe` — 포트 3000 사용 시 안내 후 중단될 수 있음)
4. 스키마 반영: `npx prisma migrate deploy` 또는 개발용 `npx prisma migrate dev` / `npx prisma db push`
5. **dev 재시작**

## 마이그레이션 기록 vs `db push`

로컬에서 `db push`만 쓴 적이 있으면 **DB 컬럼은 스키마와 맞을 수 있어도** `_prisma_migrations`와 폴더의 마이그레이션 이력이 어긋날 수 있습니다. 이때는 위 순서로 `migrate deploy`/`migrate dev`로 정리하거나, 팀 규칙에 맞게 `migrate resolve` 등으로 맞춥니다.

`20260331140000_cms_editorial_monthly_seo_source_image`의 컬럼명은 `prisma/schema.prisma`의 `EditorialContent` / `MonthlyCurationContent`와 동일합니다.
