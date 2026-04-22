# 내일 세션 시작 가이드 (2026-04-23)

**마지막 작업일**: 2026-04-22 밤  
**현재 브랜치**: feat/postgres-migration-20260422  
**마지막 커밋**: 리뷰 카드 UI + CTA 색상 개선

---

## 🎯 시작 전 체크 (2분)

### 1. 프로젝트 경로 이동

```bash
cd C:\Users\USER\Desktop\BONGTOUR
```

### 2. git 상태 확인

```bash
git status
git log --oneline -5
```

### 3. 브랜치 확인

```bash
git branch --show-current
```

(`feat/postgres-migration-20260422` 여야 함)

### 4. 최신 코드 pull (원격 변경 없을 것이지만)

```bash
git pull origin feat/postgres-migration-20260422
```

### 5. dev 서버 실행 (확인용)

```bash
npm run dev
```

`localhost:3000` 접속해서 정상 동작 확인

---

## 🎯 어제 완료된 작업

### 1. PostgreSQL 전환 (Phase A~E) ✅

- SQLite → Supabase PostgreSQL
- 9,987행 데이터 이전
- schema.prisma provider 변경
- sitemap.ts 동적 렌더링

### 2. 배포 파이프라인 복구 ✅

- Railway 빌드 성공
- 커밋 f165922

### 3. Cloudflare 실험 & 롤백 ✅

- 성능 개선 효과 제한적 확인
- 후이즈 DNS로 완벽 복원
- 학습: Railway 리전이 근본 원인

### 4. 카드 뒤집기 리뷰 UI ✅

- CSV → DB 전환 (`lib/group-meeting-reviews-db.ts`)
- Supabase `travel_reviews` 50개 연동
- 3D 플립 애니메이션
- 4초마다 순차 교체
- 50개 풀 순환

### 5. 카드 UI 개선 ✅

- 파스텔 색상 (카테고리별)
- 이모지 표시
- 호버 시 멈춤 + 확장
- 색상 깜빡임 제거 (중간 시점 교체)
- 애니메이션 800ms
- CTA 섹션 민트 그라데이션

---

## 📋 내일 할 작업 (우선순위 순)

### 🔴 우선순위 1: OG 이미지 시스템

**목표**: 카카오톡 공유 시 엉뚱한 로고 대신 페이지별 맞춤 이미지

**작업 단계**:

1. `public/og/` 폴더 생성
2. home-hub/candidates 이미지 재활용
   - `default.png` (기본)
   - `overseas.png` (해외여행)
   - `private-trip.png` (우리끼리)
   - `domestic.png` (국내여행)
   - `training.png` (국외연수)
   - `esim.png` (e-SIM)
3. 페이지별 `metadata`에 OG 이미지 경로 추가
4. `lib/site-metadata.ts`의 `DEFAULT_OG_IMAGE_PATH` 변경
5. 빌드 & 배포
6. 카카오톡 디버거로 캐시 무효화  
   https://developers.kakao.com/tool/debugger/sharing

**예상 시간**: 30~40분

**관련 파일**:

- `app/layout.tsx` (전역 OG)
- `app/travel/overseas/page.tsx`
- `app/travel/overseas/private-trip/page.tsx`
- `app/travel/domestic/page.tsx`
- `app/travel/esim/page.tsx`
- `app/training/page.tsx`
- `lib/site-metadata.ts`

---

### 🟡 우선순위 2: 3309줄 리팩토링 (HeroImageSection 분리)

**현재 상태**: `app/admin/products/[id]/page.tsx` = 2819줄

**분리 대상**: HeroImageSection (1980~2205행, 226줄)

**작업 단계**:

1. 체크포인트 커밋 (이미 되어있음: 93a0f4b)
2. Props 인터페이스 설계
3. `app/admin/products/[id]/_components/HeroImageSection.tsx` 생성
4. `page.tsx`에서 해당 섹션 삭제 + 컴포넌트 사용
5. 빌드 테스트
6. 성공 시 커밋

**Props로 전달할 것**:

- `product` (전체)
- `primaryImageMessage`, `primaryImageUploading`
- `manualHeroUploadPreset`, `setManualHeroUploadPreset`
- `manualHeroUploadOtherNote`, `setManualHeroUploadOtherNote`
- `heroReselectBusy`, `heroMetaMessage`
- `heroMetaDraft`, `setHeroMetaDraft`, `savingHeroMeta`
- `scheduleEntries`
- `id`
- `onPrimaryImageUpload` (handler)
- `onPickScheduleEntryAsHero` (handler)
- `onRunTravelProcessImagesReselect` (handler)
- `onSaveHeroImageMeta` (handler)

**예상 시간**: 30~45분

**기대 효과**: 2819 → 2593줄 (-226줄, -8%)

---

### 🟢 우선순위 3: 전자명함 기능 Phase 1

**설계 문서**: `docs/DESIGN_STAFF_CARD_20260422.md` (이미 작성됨)

**작업 단계**:

1. `schema.prisma`에 User 모델 필드 추가:
   - `staffId String? @unique`
   - `staffTitle`, `staffBio`, `staffPhone`, `staffPhoto`
   - `staffPages String[]`
   - `staffKakaoId`, `staffEmail`
   - `canShareCard Boolean @default(false)`
   - `personalOgImage String?`
   - `cardViewCount`, `shareCount Int @default(0)`
2. `npx prisma migrate dev --name add_staff_card_fields`
3. `/admin/members` 페이지 확장:
   - 전자명함 설정 섹션 추가
   - `staffId` 편집
   - `canShareCard` 체크박스
   - 기타 필드 편집 UI
4. `/staff/[staffId]/page.tsx` 생성 (전자명함 페이지)
5. `/staff/[staffId]/[slug]/page.tsx` (페이지 + 담당자 배너)

**예상 시간**: 3~4시간

**보안 체크리스트**:

- 권한 검증 (STAFF/ADMIN/SUPER_ADMIN + `canShareCard=true`)
- `staffId` 정규식 검증 (`^[a-z][a-z0-9_]{2,19}$`)
- 404 처리 (정보 누출 방지)
- XSS 방지

---

### 🔵 우선순위 4: 카드 UI 추가 개선 (선택)

**남은 요구사항**:

- `thumbnail_url` 있으면 사진 표시 (뒷면 또는 앞면 상단)
- (추후) 고객 리뷰 작성 시 사진 업로드 기능

**예상 시간**: 1~2시간

---

### ⚪ 우선순위 5: 봉sim 이식

- 계획·참고: `docs/BONGSIM_INTEGRATION_PLAN.md`, `docs/BONGSIM_MIGRATION_INPUT.md`, `docs/BONGSIM_UI_REFERENCE_FROM_BONGTOUR.md`
- 본 브랜치(Postgres/프로덕션) 안정화·OG·어드민 리팩터 이후, 별도 브랜치로 스코프를 쪼개 진행하는 것을 권장
