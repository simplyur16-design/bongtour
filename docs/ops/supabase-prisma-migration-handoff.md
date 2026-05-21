# Supabase · Prisma 마이그레이션 핸드오프 (클라우드 AI / DBA용)

**프로젝트:** BongTour (Next.js 15 + Prisma 5.22 + PostgreSQL on Supabase)  
**목적:** 운영 DB에 스키마 반영 + 로컬/CI Prisma CLI 설정 정리  
**작성 기준:** 2026-05 (국외연수 프로그램 기능 배포 직전)

---

## 1. 현재 상황 요약

| 항목 | 상태 |
|------|------|
| DB | **Supabase PostgreSQL** (실제 접속 정보는 `.env.local`) |
| Prisma 스키마 | `prisma/schema.prisma` — `provider = postgresql`, `url` + **`directUrl` 필수** |
| 마이그레이션 폴더 | `prisma/migrations/` — **37개** SQL 마이그레이션 존재 |
| 운영 DB | **이미 데이터·테이블 있음** (비어 있지 않음) |
| `_prisma_migrations` | 이력이 앱 스키마와 **동기화되지 않은 상태**로 추정 → `prisma migrate deploy` 시 **P3005** 가능 |
| 로컬 `.env` | `DATABASE_URL`만 있고 **`DIRECT_URL` 없음** → Prisma CLI만 실행 시 **P1012** |
| 로컬 `.env.local` | Supabase용 `DATABASE_URL` + `DIRECT_URL` **둘 다 있음** (Next.js 앱은 이쪽 사용) |

**결론:**  
- **당장 국외연수 기능만** 켜려면 → Supabase SQL Editor에서 **아래 §4 SQL 6줄** 실행이 가장 빠름.  
- **장기적으로 Prisma migrate 이력까지** 맞추려면 → §5 baseline + §6 로컬 env 정리 필요.

---

## 2. Prisma 데이터소스 설정 (코드 SSOT)

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // 앱·풀러( Supabase Transaction pooler 6543 등 )
  directUrl = env("DIRECT_URL")     // 마이그레이션·직접 연결( Supabase Direct 5432 )
}
```

- **앱 런타임** (`lib/prisma.ts`): `DATABASE_URL`만 사용, `connection_limit=1` 자동 보강.
- **Prisma CLI** (`migrate`, `db push`, `studio`): `.env` 로드 + **`DIRECT_URL` 필수** (스키마 검증).

### Supabase 연결 문자열 역할

| 변수 | Supabase 대시보드 | 용도 |
|------|-------------------|------|
| `DATABASE_URL` | **Transaction pooler** (포트 6543) 또는 Session mode | Next.js 서버, 일반 쿼리 |
| `DIRECT_URL` | **Direct connection** (포트 5432) | `prisma migrate 
deploy`, DDL |

> 풀러 URL을 `DIRECT_URL`에 넣으면 마이그레이션이 실패하거나 불안정할 수 있음.

---

## 3. 환경 변수 — 로컬 vs 클라우드

### Next.js (앱)

- 로드 순서: `.env` → `.env.local` (**.env.local 우선**)
- 개발·운영 앱은 **`.env.local` 또는 서버 `.env.production`** 의 Supabase URL 사용.

### Prisma CLI

- **`.env`만 자동 로드** (`.env.local`은 기본으로 읽지 않음)
- 그래서 터미널에서 `npx prisma migrate deploy`만 치면 `DIRECT_URL` 없음 오류 발생.

### 권장 로컬 정리 (개발자 PC)

`.env`에 아래를 **`.env.local`과 동일한 값**으로 추가 (비밀값은 Git 커밋 금지):

```env
DATABASE_URL="(Supabase pooler URL — .env.local 과 동일)"
DIRECT_URL="(Supabase Direct URL — .env.local 과 동일)"
```

또는 PowerShell에서 매번:

```powershell
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    $n = $matches[1].Trim()
    $v = $matches[2].Trim().Trim('"').Trim("'")
    Set-Item -Path "env:$n" -Value $v
  }
}
npx prisma migrate deploy
```

### 클라우드 배포 서버 (Naver Cloud 등)

- `.env.production`에 `DATABASE_URL` + `DIRECT_URL` 둘 다 설정.
- `npm run build` 전 `prisma generate`는 `prebuild`에 포함됨.

---

## 4. 【우선 실행】국외연수 컬럼만 추가하는 SQL

**마이그레이션 파일:** `prisma/migrations/20260520120000_overseas_training_program_fields/migration.sql`

Supabase **SQL Editor** → 실행 (멱등, `IF NOT EXISTS`):

```sql
-- 국외연수 프로그램 Product 필드
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fixedDepartureWeekday" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trainingCategory" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trainingAudience" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trainingDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "prepChecklistJson" TEXT;
```

### 컬럼 의미

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `fixedDepartureWeekday` | INTEGER | 고정 출발 요일 `0=일` … `6=토`. 공개 UI: 「화요일 출발」 |
| `durationDays` | INTEGER | 프로그램 일수 (예: 9) |
| `trainingCategory` | TEXT | 8분야 taxonomy key |
| `trainingAudience` | TEXT | `public` \| `corporate` \| `both` |
| `trainingDescription` | TEXT | 상품설명 본문 |
| `prepChecklistJson` | TEXT | 여행준비·체크 JSON 문자열 |

### 확인 쿼리

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Product'
  AND column_name IN (
    'fixedDepartureWeekday',
    'durationDays',
    'trainingCategory',
    'trainingAudience',
    'trainingDescription',
    'prepChecklistJson'
  )
ORDER BY column_name;
-- 기대: 6 rows
```

### `listingKind` 값 (앱 enum, DB는 TEXT)

- 국외연수 프로그램: `listingKind = 'overseas_training'`
- 기존: `travel`, `private_trip`, `air_hotel_free`
- `/products` browse에는 **노출하지 않음** — `/business/programs` 전용

---

## 5. Prisma migrate 전체 이력 맞추기 (선택 · 고급)

운영 DB가 이미 Prisma 없이 스키마가 쌓인 경우 `migrate deploy`는 **P3005** (non-empty database) 발생.

### 옵션 A — Baseline (권장, DBA 협업)

1. 운영 DB 스키마가 **이미 최신에 가깝다**는 것을 확인 (§4 SQL 포함).
2. `prisma/migrations` 폴더의 마이그레이션을 **이미 적용된 것으로 표시**:
   - [Prisma Baseline 문서](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/baselining)
   - 예: `npx prisma migrate resolve --applied "20260520120000_overseas_training_program_fields"`
3. 이후 신규 마이그레이션만 `migrate deploy`.

### 옵션 B — `prisma db push` (로컬/스테이징만)

- `npm run db:push` → 스키마를 DB에 맞춤, **이력 테이블 없음**.
- **운영 Supabase에는 비추** (드리프트·롤백 어려움).

### 미적용 마이그레이션 목록 (37개 중 전부 pending으로 보고된 사례)

최신 포함 이름 예:

- `20260520120000_overseas_training_program_fields` ← **국외연수**
- `20260519120000_product_slug`
- … (20250320120000부터 누적)

**주의:** 운영 DB에 이미 수동/다른 경로로 반영된 마이그레이션이 많을 수 있음. **전체 deploy를 무조건 실행하지 말 것.** diff 확인 후 baseline.

---

## 6. 로컬 Prisma 체크리스트 (개발자)

```bash
# 1) .env 에 DATABASE_URL + DIRECT_URL 설정 (.env.local 과 동일)

# 2) 클라이언트 생성
npx prisma generate

# 3) (선택) 마이그레이션 상태
npx prisma migrate status

# 4) (§4 SQL을 Supabase에서 이미 실행했다면) migrate deploy는 스킵 가능

# 5) 검증 스크립트
npx tsx scripts/verify-overseas-training-taxonomy.ts
npx tsx scripts/verify-inquiry-notification-format.ts

# 6) 빌드
npm run build
```

---

## 7. 이번에 구현된 앱 기능 (DB 의존)

### 공개

- `/business` — 허브 (통역 대섹션·하단 CTA 제거, 프로그램 미리보기)
- `/business/programs` — 목록
- `/business/programs/[slug]` — 상세 (가격·예약 없음)
- 상세 **상세일정** 탭: `fixedDepartureWeekday` 기준 **1년 달력**, 날짜 클릭 시 DAY별 캘린더 날짜 표시

### 관리자

- `/admin/training-programs` (목록)
- `/admin/training-programs/new` (윈저 paste → 3블록 분할)
- `/admin/training-programs/[id]` (편집, Gemini 이미지 2슬롯)
- `/admin/training-programs/guide` (운영 가이드)

### Product 운영 규칙

- `listingKind = overseas_training`, `registrationStatus = registered` 만 공개
- `priceFrom` = null, `ProductDeparture` 미사용
- `originSource` 신규 등록 시 `windsor` (윈저 import), slug `otr-bt-####`

---

## 8. 클라우드 AI에 붙여 넣을 프롬프트

```
당신은 Supabase(PostgreSQL) + Prisma Migrate 담당입니다.

【프로젝트】BongTour — Next.js, Prisma 5.22, schema: prisma/schema.prisma
【DB】Supabase PostgreSQL, public 스키마, Product 테이블 이미 존재·데이터 있음

【문제】
1) 로컬 Prisma CLI는 .env만 읽어 DIRECT_URL 없으면 P1012
2) migrate deploy 시 DB가 비어있지 않아 P3005 가능 (_prisma_migrations 미정렬 추정)
3) 국외연수 기능에 필요한 Product 컬럼 6개가 DB에 없을 수 있음

【요청 1 — 최우선】
아래 SQL을 Supabase SQL Editor에서 안전하게 실행하고, 6컬럼 존재를 information_schema로 확인해 주세요.
데이터 삭제·DROP·TRUNCATE 금지. IF NOT EXISTS 사용.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fixedDepartureWeekday" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trainingCategory" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trainingAudience" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trainingDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "prepChecklistJson" TEXT;

【요청 2 — Prisma 연결 가이드】
- DATABASE_URL = Supabase Transaction pooler (앱용)
- DIRECT_URL = Supabase Direct connection 5432 (migrate용)
- 두 값을 개발 .env 와 배포 환경에 모두 문서화

【요청 3 — migrate 이력 (선택)】
_prisma_migrations 테이블 상태를 조회하고,
이미 스키마에 반영된 migration은 resolve --applied 로 baseline 할지,
아직 없는 DDL만 골라 적용할지 제안해 주세요.
37개 migration 폴더가 prisma/migrations 에 있음.
무조건 전체 deploy 하지 말고 diff 기준으로 진행.

【성공 기준】
- Product 6컬럼 존재
- 앱에서 /admin/training-programs 저장 시 trainingDescription 등 오류 없음
- Prisma Client 필드와 DB 일치
```

---

## 9. 관련 파일 경로

| 경로 | 설명 |
|------|------|
| `prisma/schema.prisma` | Prisma SSOT (PostgreSQL) |
| `prisma/migrations/20260520120000_overseas_training_program_fields/` | 국외연수 DDL |
| `lib/overseas-training-admin.ts` | 관리자 CRUD |
| `lib/overseas-training-program-query.ts` | 공개 조회 |
| `docs/ops/overseas-training-admin-stack.md` | 기능·URL SSOT |

---

## 10. 하지 말 것

- 운영 DB에 확인 없이 37개 마이그레이션 **일괄** `migrate deploy`
- `DIRECT_URL`에 pooler(6543) URL 넣기
- `.env`에 실제 비밀값 커밋
- 국외연수 프로그램에 `ProductDeparture` / 가격 동기화 붙이기 (의도적으로 미사용)
