# 봉투어 SQLite → Supabase PostgreSQL 마이그레이션 계획

> 작성일: 2026-04-22  
> 대상: `prisma/schema.prisma` + `prisma/dev.db` (실측 약 **45.69 MB**, 문서상 46MB 근사)  
> 목표 DB: Supabase PostgreSQL (**session pooler**, `DATABASE_URL`에 `sslmode=require` + Node/pg 시 쿼리스트립·`rejectUnauthorized: false` 패턴은 별도 문서 참고)  
> 원칙: **이미지 URL 깨짐 0건**, **데이터 손실 0건**

---

## 0. 스키마 분석 요약 (1단계)

### 0-1. `datasource` / `generator`

| 항목 | 현재 값 |
|------|---------|
| `provider` | `sqlite` |
| `url` | `env("DATABASE_URL")` |
| `generator output` | `../prisma-gen-runtime` (마이그레이션과 무관, 클라이언트 생성 경로) |

### 0-2. 모델 수·공통 패턴

- **모델 개수:** **27**
- **`enum` 정의:** **없음** (상태·유형은 전부 `String` + 앱 레벨 상수/Zod)
- **`Json` Prisma 타입:** **없음** — JSON 페이로드는 **`String`** 으로 저장 (주석에 “JSON 문자열” 명시된 필드 다수)
- **`@db.*` (네이티브 타입):** **없음** — PostgreSQL 전환 시 필요하면 **선택적**으로 `@db.Text` 등 추가 검토 가능하나, 기본 매핑으로도 동작 가능성이 큼
- **`@@map` / `@map`:** **`ImageAsset` → 테이블 `image_assets`** (snake_case 컬럼 `@map` 다수). 나머지 모델은 Prisma 기본 네이밍(대부분 PascalCase 테이블명)

### 0-3. 특별 점검 항목 (전 모델 공통 메모)

| 주제 | 스키마 상황 | PostgreSQL 이전 시 |
|------|----------------|---------------------|
| `@default(autoincrement())` + `Int @id` | `AgentScrapeReport`, `ScraperQueue`, `Itinerary`, `Booking` | `SERIAL` / `GENERATED … AS IDENTITY` 등으로 자연 매핑. **기존 정수 PK 값 유지**하려면 시퀀스 시드 조정 필요 |
| `@default(cuid())` / `String @id` | 대부분의 마스터·자식 테이블 | **변경 없음** |
| `@unique` / `@@unique` | 다수 (예: `Product` 복합 유니크, `PhotoPool.filePath`, `ProductPrice` 복합 등) | PG에서 **UNIQUE 제약**으로 동일. 이전 순서에서 중복 정리 필요 |
| `@@index` | `AssetUsageLog`, `MonthlyCurationItem`, `EditorialContent`, `MonthlyCurationContent`, `CustomerInquiry`, `ImageAsset`, `RegisterAdmin*` | `CREATE INDEX` 로 이전 |
| `DateTime` + `@default(now())` / `@updatedAt` | 광범위 | `timestamptz` 권장( Supabase 기본 ). `@updatedAt` 는 앱/Prisma가 갱신 |
| `Float` | `Booking.totalLocalAmount`, `Product.mandatoryLocalFee` 등 | PostgreSQL `double precision` (또는 금액 정밀도 요구 시 이후 `Decimal` 검토) |
| `Boolean` | 광범위 | `boolean` |
| Relation `onDelete` | `Cascade`, `Restrict`, `SetNull` 혼재 | FK 제약으로 동일 이전. **데이터 이전 순서**와 함께 검증 |
| RLS / Check | SQLite에는 없음 | Supabase **`image_assets`**, **`travel_reviews`** 에는 이미 **RLS·CHECK** 존재 (`db pull` 경고 참고). 앱이 **service role** 로 붙는지 **PostgREST anon** 으로 붙는지에 따라 동작 다름 |

### 0-4. 모델별 스칼라·관계·제약 개수 (요약 표)

스칼라 = `String` / `Int` / `Float` / `Boolean` / `DateTime` 등 Prisma 스칼라 타입 필드 수(관계 스칼라 `productId` 등 포함). 상세 필드명은 **`prisma/schema.prisma`** SSOT.

| # | 모델 | 스칼라 필드 수(대략) | 관계 필드 | `@@unique` | `@@index` |
|---|------|---------------------:|----------:|-----------:|----------:|
| 1 | Product | 99 | 10 | 1 | 0 |
| 2 | OptionalTour | 6 | 1 | 0 | 0 |
| 3 | ProductPrice | 9 | 1 | 1 | 0 |
| 4 | AgentScrapeReport | 7 | 0 | 0 | 0 |
| 5 | ScraperQueue | 3 | 0 | 0 | 0 |
| 6 | Itinerary | 4 | 1 | 0 | 0 |
| 7 | ItineraryDay | 18 | 1 | 1 | 0 |
| 8 | ProductDeparture | 49 | 1 | 1 | 0 |
| 9 | HanatourMonthlyBenefit | 11 | 0 | 1 | 0 |
| 10 | Booking | 27 | 1 | 0 | 0 |
| 11 | User | 20 | 2 | 0 | 0 |
| 12 | Account | 12 | 1 | 1 | 0 |
| 13 | Session | 4 | 1 | 0 | 0 |
| 14 | VerificationToken | 3 | 0 | 1 | 0 |
| 15 | Destination | 5 | 0 | 0 | 0 |
| 16 | DestinationGalleryCache | 5 | 0 | 0 | 0 |
| 17 | DestinationImageSet | 6 | 0 | 0 | 0 |
| 18 | PhotoPool | 7 | 0 | 0 | 0 |
| 19 | AssetUsageLog | 11 | 1 | 0 | 3 |
| 20 | Brand | 13 | 1 | 0 | 0 |
| 21 | MonthlyCurationItem | 16 | 2 | 0 | 2 |
| 22 | EditorialContent | 26 | 0 | 0 | 3 |
| 23 | MonthlyCurationContent | 26 | 0 | 0 | 4 |
| 24 | CustomerInquiry | 25 | 2 | 0 | 6 |
| 25 | ImageAsset | 33 | 0 | 0 | 2 |
| 26 | RegisterAdminInputSnapshot | 14 | 1 | 0 | 3 |
| 27 | RegisterAdminAnalysis | 18 | 1 | 0 | 2 |

**참고:** SQLite `prisma/dev.db` 에는 **`travel_reviews` 테이블이 없음** (Supabase에만 존재). 이전 후 Prisma에 `travel_reviews` 모델을 추가할 때는 **기존 50행**과 충돌하지 않도록 마이그레이션 순서·`@@map` 설계 필요.

---

## 1. 현재 상태

### 1-1. DB 구조

- **SQLite** (`prisma/dev.db`, 실측 **약 45.69 MB**)
- **27개 모델** (`prisma/schema.prisma`)
- **Supabase에 이미 존재** (이전 `db pull`·런타임 기준)
  - **`image_assets`**: SQLite에서 **행 0** / Supabase에서도 마이그레이션 시점에 **0 또는 소량** 가능 — 스키마·RLS·CHECK는 이미 존재
  - **`travel_reviews`**: **마케팅용 약 50행** (문서 상 50; 실제는 Supabase에서 확인)

### 1-2. 현재 데이터 (테이블별 행 수)

`scripts/_count-all-tables.mjs` 실행 결과 ( `_prisma_*` / `sqlite_*` 제외):

| 테이블 | 행 수 |
|--------|------:|
| Account | 4 |
| AgentScrapeReport | 0 |
| AssetUsageLog | 614 |
| Booking | 7 |
| Brand | 0 |
| CustomerInquiry | 16 |
| Destination | 0 |
| DestinationGalleryCache | 0 |
| DestinationImageSet | 0 |
| EditorialContent | 0 |
| HanatourMonthlyBenefit | 0 |
| Itinerary | 499 |
| ItineraryDay | 499 |
| MonthlyCurationContent | 5 |
| MonthlyCurationItem | 0 |
| OptionalTour | 0 |
| PhotoPool | 184 |
| Product | 89 |
| ProductDeparture | 4355 |
| ProductPrice | 3150 |
| RegisterAdminAnalysis | 278 |
| RegisterAdminInputSnapshot | 282 |
| ScraperQueue | 0 |
| Session | 0 |
| User | 5 |
| VerificationToken | 0 |
| image_assets | 0 |

**데이터 볼륨 상위:** `ProductDeparture` (4355) → `ProductPrice` (3150) → `AssetUsageLog` (614) → `Itinerary` / `ItineraryDay` (각 499).

### 1-3. 이미지 URL 저장 현황

- **Supabase Storage `bongtour-images`:** **282개** 객체 (Storage 메타 기준)
- **SQLite 텍스트 컬럼**에 URL/경로가 저장되며, **문자열 그대로 INSERT 시 URL 손상 없음** (이미 검증 스크립트로 `supabase.co` / `bongtour-images` 매칭)
- **요약 (SQLite):**
  - `Product.bgImageUrl`: Supabase URL 다수 + Pexels 등 외부 URL 혼재
  - `Product.schedule` 등 JSON 문자열: 일정 내 `imageUrl` 에 Supabase URL 포함 가능
  - `PhotoPool.filePath`: Supabase URL **181행** + Ncloud 등 레거시
  - `AssetUsageLog.assetPath` / `notes`: Supabase URL·치환 로그
  - `MonthlyCurationContent.imageUrl`: 소량
  - `ItineraryDay.heroImageBundle`: JSON 문자열 내 URL 가능

---

## 2. 모델별 변환 체크리스트

공통 규칙: **Prisma 스칼라 타입 → PostgreSQL 기본 매핑** (`String` → `text`, `Int` → `integer`, `Boolean` → `boolean`, `DateTime` → `timestamp`, `Float` → `double precision`). JSON 성격 필드는 **현状 `text`** 로 유지해도 앱 호환 유지가 쉬움(이후 `jsonb` + 캐스팅은 선택 과제).

### 2-1. 소형 모델 예시: `VerificationToken`

| 필드 | Prisma / SQLite | PostgreSQL 변환 | 비고 |
|------|-----------------|-----------------|------|
| identifier | String | text | `@@unique([identifier, token])` |
| token | String | text | |
| expires | DateTime | timestamptz | |

### 2-2. 소형 모델 예시: `ScraperQueue`

| 필드 | Prisma / SQLite | PostgreSQL 변환 | 비고 |
|------|-----------------|-----------------|------|
| id | Int @id @default(autoincrement()) | serial / identity | 시퀀스 시드 |
| productId | String | text | FK 후보는 아님(스키마상 Product relation 없음) |
| createdAt | DateTime | timestamptz | `@default(now())` |

### 2-3. `ImageAsset` (`@@map("image_assets")`)

| 항목 | 내용 |
|------|------|
| 테이블명 | PostgreSQL에서 **`image_assets`** (snake_case 컬럼 `@map` 이미 정의) |
| SQLite | 동일 구조로 **행 0** |
| Supabase | **이미 테이블·제약·RLS 존재** → `prisma migrate` 시 **CREATE 충돌** 방지 필요 (`IF NOT EXISTS` / 기존 스키마 import / 수동 reconcile) |

(나머지 필드는 `schema.prisma` 의 `@map("…")` 그대로 PG 컬럼명이 됨.)

### 2-4. 대형 모델 (`Product`, `ProductDeparture`, `CustomerInquiry` 등)

| 모델 | 필드 수 규모 | PostgreSQL 시 주의 |
|------|----------------|---------------------|
| Product | 스칼라 ~99 + 관계 10 | **복합 `@@unique([originSource, originCode])`**, 대량 **nullable String**, **Float/Int 혼재**. 마이그레이션 스크립트는 **컬럼 목록 명시 INSERT** 권장 |
| ProductDeparture | 스칼라 ~49 | **날짜+시간** 컬럼 다수 (`DateTime?`). 타임존 일관성(`timestamptz`) |
| ProductPrice | 스칼라 9 | **`@@unique([productId, date])`** — `date` 는 시각 포함 가능 |
| CustomerInquiry | 스칼라 25 + 인덱스 6 | `payloadJson` 등 **대용량 text** |
| RegisterAdmin* | 스냅샷·분석 파이프라인 | **텍스트/JSON 문자열** 대용량 |

**27개 전 모델의 필드별 전개 표**는 본 문서에 모두 적지 않고, **위 0-4 요약표 + `prisma/schema.prisma`** 를 SSOT로 두고, 실무에서는 **`prisma migrate diff`** 또는 **임시 Postgres에 `db pull` → 비교**로 검증하는 것이 유지보수에 유리함.

---

## 3. 주의 사항

### 3-1. 변경 필요한 부분

- **`datasource db` `provider`:** `"sqlite"` → **`"postgresql"`**
- **`DATABASE_URL`:** Railway 등에서 **`file:./prisma/dev.db`** → **Supabase pooler URL** (이미 `.env.local` 에 패턴 존재)
- **기존 Supabase 테이블과의 충돌:** `image_assets`, `travel_reviews` — **빈 `CREATE` 마이그레이션 불가**. “이미 있는 스키마”와 Prisma 스키마를 **단일 진실원**으로 맞추는 작업 선행
- **정수 autoincrement PK** (`Booking.id` 등): PostgreSQL에서 **시퀀스**와 **기존 row 값** 일치 여부 확인
- **Node `pg` / Prisma 엔진 SSL:** URL의 `sslmode=require` 만으로는 **인증서 체인 오류**가 날 수 있음 → 운영·마이그레이션 스크립트에서 **연결 옵션** 정리 (`docs/PRISMA_SUPABASE_SSL.md` 참고)

### 3-2. 변경 없이(또는 거의 없이) 가져가도 되는 부분

- **`String` / `Int` / `Boolean` / `DateTime` / `Float`** 조합
- **`@default(cuid())`**, **`@default(now())`**, **`@updatedAt`**
- **Relation 정의 자체** (FK 제약 이름만 PG에서 자동 생성될 수 있음)

### 3-3. 새로 추가·정렬할 것

- **`travel_reviews` 모델** (Supabase 기존 테이블에 `@@map` 또는 동일 테이블명)
- **`image_assets`**: Prisma에는 이미 `ImageAsset` + `@@map` — **원격 DB 실제 DDL** 과 Prisma 정의 **diff** 필수 (CHECK·RLS는 Prisma 스키마에 전부 표현되지 않음)

---

## 4. 마이그레이션 실행 계획

### Phase A: 로컬 테스트 (기존 `schema.prisma` 미변경 브랜치 작업 권장)

1. 브랜치 생성: `feat/postgres-migration-20260422` (이름 예시)
2. `prisma/schema.prisma` **복사본** `schema.postgres.prisma` (또는 별도 폴더)에서만 `provider = "postgresql"` 로 **`prisma validate --schema=`** 시도
3. 에러 없을 때까지 **복사본만** 수정해 학습 (본편 `schema.prisma` 는 사용자 지시 전까지 비변경)

### Phase B: Supabase에 빈 스키마 적용 (테스트)

5. `DATABASE_URL` 은 `.env.local` 의 Supabase URL 활용 (로컬 전용)
6. `prisma migrate diff` / `migrate dev --create-only` 등으로 **SQL 초안 생성** (실행은 검토 후)
7. 생성 SQL에서 **`CREATE TABLE image_assets` / `travel_reviews`** 등 **충돌 구문** 제거 또는 `IF NOT EXISTS` / **baseline** 전략 선택
8. **RLS·policy** 는 Prisma 마이그레이션 외 **대시보드·수동 SQL** 로 관리될 수 있음을 전제

### Phase C: 데이터 이전

9. 스크립트 예: `scripts/migrate-sqlite-to-postgres.mjs` (신규)
10. 테이블별 **bulk insert** (배치 크기 튜닝)
11. **FK 순서:** `User` → `Account`/`Session` → `Brand` → `Product` → (자식들) → `Booking` 등. **`onDelete: Restrict`** 인 부모 먼저
12. 진행 로그·에러 row 파일 남기기

### Phase D: 검증

13. 테이블별 **행 수 비교** (SQLite vs Postgres)
14. **샘플 row** 해시 비교(주요 컬럼)
15. **이미지 URL 1건** 브라우저로 200 확인 (Supabase public + 외부 CDN)

### Phase E: Railway 반영

16. Railway Variables 의 **`DATABASE_URL`** 교체
17. 재배포
18. 실시간 smoke test (예약·상품·관리자 업로드)
19. 이상 시 **`DATABASE_URL` 롤백** → SQLite 복귀

---

## 5. 롤백 시나리오

| 문제 | 증상 | 복구 방법 |
|------|------|----------|
| Prisma migrate 실패 | 스키마 불일치 | 마이그레이션 SQL 분리·충돌 테이블 수동 정리, 로컬/스테이징만 영향 시 브랜치 리셋 |
| 데이터 이전 중단 | 일부만 이전 | PG **truncate** (FK 순서 유의) 후 재실행 |
| Railway 배포 실패 | 앱 기동 실패 | `DATABASE_URL` 원복 + SQLite `dev.db` 복구 |
| 이미지 URL 깨짐 | 이미지 404 | 문자열 그대로 이전 원칙 유지 + **잘못된 base URL 치환** 여부 점검 |
| 응답 지연 | API 지연 | 풀러 **세션 vs 트랜잭션**, 리전, 연결 수 제한 점검 |

---

## 6. 체크포인트

실행 전 확인:

- [ ] SQLite 백업 존재 (예: `prisma/dev.backup-before-db-push.db` 등 — **프로젝트 내 파일명은 시점별 상이**, `backup-prod-20260421-174434.db` 는 **예시**. 실제 사용 백업 경로를 운영 기록에 명시)
- [ ] Git 커밋·작업 브랜치 정리
- [ ] Railway 현재 `DATABASE_URL` 스냅샷 기록 (문서/비밀관리 도구)
- [ ] Supabase 연결 테스트 성공 (로컬에서 `pg` / Prisma `db pull` 등 이미 수행된 전제)
- [ ] 서비스 영향 최소 시간대

---

## 7. 예상 소요 시간

| Phase | 예상 |
|-------|------|
| A | 30분 |
| B | 30분 |
| C | 1시간 |
| D | 30분 |
| E | 15분 |
| **합계** | **약 3시간** (충돌·RLS·데이터 품질 이슈 시 추가) |

---

## 부록: 스크립트

- **`scripts/_count-all-tables.mjs`**: SQLite 테이블별 행 수 출력 — **재사용 유지 권장**
- **`.gitignore`:** 현재 `scripts/_test-*.mjs` 만 명시. **`scripts/_count-all-tables.mjs`** / **`_check-*.mjs`** 를 커밋에 포함하려면 ignore 패턴 확대 시 주의

---

## 산출물

- 본 문서: **`docs/MIGRATION_SQLITE_TO_POSTGRES_PLAN.md`**
- `prisma/schema.prisma`: **변경 없음** (요청 준수)
