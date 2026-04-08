# 봉투어 MVP 구현 계획 (기준: BONGTOUR-MASTER-PLATFORM-DESIGN v0.2)

**범위:** 공통 CTA·고지 레이어 + `CustomerInquiry` + 4종 문의폼 + 관리자 수신 MVP + 월별 큐레이션 최소 모델·메인 연동.  
**비범위(2차):** `product_curation_meta`, Gemini 파이프, `lead_time_rule` 테이블, 자동 큐레이션 생성, 고급 라우팅.

---

## 1. MVP 목표 한 줄

**공통 고지·CTA를 컴포넌트로 고정한 뒤, 단일 `CustomerInquiry` 저장소와 4종 폼·관리자 목록·수동 입력 월별 큐레이션 카드로 메인까지 연결한다.**

---

## 2. 1차 구현 순서 (권장)

| 순서 | 작업 |
|------|------|
| P0 | Prisma: `CustomerInquiry`, `MonthlyCurationItem` 마이그레이션 |
| P1 | `lib/bongtour-copy.ts` (문구 상수) + 공통 고지/CTA 컴포넌트 |
| P2 | `POST /api/inquiries` + 스냅샷·`lead_time_risk` 단순 휴리스틱 |
| P3 | `/inquiry` 페이지 + 4종 폼(쿼리 `type` 분기) + 완료 상태 |
| P4 | `GET/PATCH /api/admin/inquiries` + `/admin/inquiries` 목록 MVP |
| P5 | `GET /api/curations/monthly` (published만) |
| P6 | `app/page.tsx`에 국내/국외 큐레이션 섹션 + 카드 CTA 연결 |

---

## 3. Prisma 모델/필드 초안

### 3.1 `CustomerInquiry`

```prisma
model CustomerInquiry {
  id                       String   @id @default(cuid())
  inquiryType              String   // travel_consult | institution_request | overseas_training_quote | bus_quote
  status                   String   @default("received") // received | reviewing | contacted | quoted | scheduled | closed | dropped
  leadTimeRisk             String   @default("normal")  // normal | late | urgent

  applicantName            String
  applicantPhone           String
  applicantEmail           String?
  message                  String?  // 공통 자유 메시지; 유형별 JSON은 extension 필드로

  productId                String?
  product                  Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  monthlyCurationItemId    String?
  monthlyCurationItem      MonthlyCurationItem? @relation(fields: [monthlyCurationItemId], references: [id], onDelete: SetNull)

  snapshotProductTitle     String?
  snapshotCardLabel        String?

  routingReasonJson        String?  // MVP: { "source": "form", "path": "/inquiry" } 수준
  sourcePagePath           String?
  privacyAgreed            Boolean  @default(false)

  // 유형별 확장 (MVP: JSON 문자열 1개로도 가능, 또는 nullable 컬럼 최소 세트)
  payloadJson              String?  // institution/overseas/bus 전용 필드 직렬화

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([inquiryType])
  @@index([status])
  @@index([createdAt])
  @@index([leadTimeRisk])
}
```

`Product` 모델에 `inquiries CustomerInquiry[]` 역관계 추가.

### 3.2 `MonthlyCurationItem` (MVP: 부모 테이블 없이 플랫)

설계서의 `monthly_curations` 묶음은 2차로 미루고, MVP는 **행 하나 = 메인 카드 한 장**.

```prisma
model MonthlyCurationItem {
  id                    String   @id @default(cuid())
  yearMonth             String   // "YYYY-MM"
  scope                 String   // domestic | overseas  (문서의 international = overseas 로 통일)

  destinationName       String
  oneLineTheme          String
  whyNowText            String
  recommendedForText    String
  leadTimeLabel         String   // 관리자 입력 문구 (lead_time_rule 연동은 2차)

  primaryInquiryType    String   // travel_consult | institution_request | overseas_training_quote | bus_quote
  briefingSourceType    String   // supplier_based | bongtour_editorial | hybrid

  linkedProductId       String?
  linkedProduct         Product? @relation(fields: [linkedProductId], references: [id], onDelete: SetNull)

  sortOrder             Int      @default(0)
  status                String   @default("draft") // draft | published
  isActive              Boolean  @default(true)    // published 중 비노출 토글

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  inquiries             CustomerInquiry[]

  @@index([yearMonth, scope, status, isActive])
}
```

`Product`에 `monthlyCurationItems MonthlyCurationItem[]` 추가.

---

## 4. API 라우트 목록

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/inquiries` | 공개 | 문의 생성; 본문에서 `inquiryType`, 스냅샷, `leadTimeRisk` 계산 |
| GET | `/api/curations/monthly` | 공개 | 쿼리 `scope`, `yearMonth`(선택); `status=published` & `isActive=true` 만 |
| GET | `/api/admin/inquiries` | 관리자 | 목록+필터 쿼리 |
| PATCH | `/api/admin/inquiries/[id]` | 관리자 | `status` 등 최소 수정 |

(선택 MVP+) `POST /api/admin/curations/items` — 시드/수동 등록용; 없으면 Prisma Studio로 시드.

---

## 5. 페이지/컴포넌트 목록

### 라우트 (App Router)

| 경로 | 역할 |
|------|------|
| `app/page.tsx` | 메인 — 큐레이션 섹션 2개(국내/국외) + 공통 고지 |
| `app/inquiry/page.tsx` | 4종 폼; `searchParams.type` |
| `app/inquiry/success/page.tsx` | 제출 완료 (또는 동일 페이지 내 state) |
| `app/admin/inquiries/page.tsx` | 문의 목록 MVP |

### 컴포넌트 (제안 경로)

| 파일 | 역할 |
|------|------|
| `lib/bongtour-copy.ts` | 고지·CTA·완료 문구 상수 |
| `components/bongtour/BongtourDisclosureBlock.tsx` | 공급사 관계 + 오인방지 묶음 |
| `components/bongtour/BongtourCtaButton.tsx` | variant: `bookRequest` \| `consult` \| `customItinerary` + `href`/`onClick` |
| `components/bongtour/InquirySuccessPanel.tsx` | 완료 문구 + 다음 액션 링크 |
| `components/bongtour/MonthlyCurationSection.tsx` | scope 탭/제목 + 카드 그리드 |
| `components/bongtour/MonthlyCurationCard.tsx` | 카드 UI 계약 + CTA |
| `components/inquiry/InquiryFormShell.tsx` | 레이아웃 + Disclosure + 제출 핸들러 공통 |
| `components/inquiry/forms/TravelConsultForm.tsx` | `travel_consult` |
| `components/inquiry/forms/InstitutionRequestForm.tsx` | `institution_request` |
| `components/inquiry/forms/OverseasTrainingQuoteForm.tsx` | `overseas_training_quote` |
| `components/inquiry/forms/BusQuoteForm.tsx` | `bus_quote` |
| `components/admin/InquiryListTable.tsx` | 테이블 + 필터 |

### 미들웨어

- `/api/admin/inquiries` — 기존 관리자 세션·`requireAdmin` 패턴 재사용.

---

## 6. 공통 CTA/고지 레이어 구현안

### 컴포넌트명·props

**`BongtourCtaButton`**

```tsx
type CtaVariant = 'bookRequest' | 'consult' | 'customItinerary'

type Props = {
  variant: CtaVariant
  href?: string
  onClick?: () => void
  className?: string
  disabled?: boolean
}
```

- `bookRequest` → 라벨: 예약신청하기  
- `consult` → 상담 신청하기  
- `customItinerary` → 맞춤 일정 문의하기  

**`BongtourDisclosureBlock`**

```tsx
type Props = {
  compact?: boolean  // 푸터 vs 폼 상단
  showSupplierRelation?: boolean
  showBookingDisclaimer?: boolean
}
```

### 문구 분리

- **`lib/bongtour-copy.ts`** 에 `DISCLOSURE`, `CTA_LABELS`, `INQUIRY_SUCCESS_BY_TYPE` export.  
- 제미나이 없음; 추후 i18n 시 같은 키 구조 유지.

### 재사용 위치

- `app/layout.tsx` 하단 푸터 인근(선택) 또는 메인/상세/문의만  
- `app/inquiry` — 폼 위·아래  
- `app/inquiry/success`  
- 상품 상세 `app/products/[id]/page.tsx` — CTA 교체 시 (MVP 후반)

---

## 7. 4종 문의폼 구현안

### 방식

- **별도 페이지 `/inquiry`** + **`?type=`** 쿼리. 모달은 모바일·접근성·딥링크 때문에 2차.

### 공통 필드 (모든 폼)

- 이름, 휴대폰, 이메일(선택), 개인정보 동의, 메시지(선택 또는 유형별 필수)  
- hidden: `inquiryType`, `productId`, `monthlyCurationItemId`, `sourcePagePath`

### 개별 필드 → `payloadJson`에 넣을 키 (MVP)

| 폼 | inquiry_type | payloadJson 예시 키 |
|----|----------------|---------------------|
| 일반 여행 | `travel_consult` | `wishDepartureMonth`, `paxAdult`, `paxChild` |
| 연수기관 섭외 | `institution_request` | `institutionField`, `visitPurpose`, `interpretationNeeded` |
| 국외연수 견적 | `overseas_training_quote` | `orgName`, `programGoal`, `durationNote`, `paxEstimate` |
| 전세버스 | `bus_quote` | `serviceDateRange`, `pickupArea`, `dropoffArea`, `paxEstimate` |

### 제출 후 문구

- `lib/bongtour-copy.ts` 의 `INQUIRY_SUCCESS_BY_TYPE[inquiryType]` 표시.

### CTA 연결

- 큐레이션 카드: `href={`/inquiry?type=${primaryInquiryType}&curationItemId=${id}`}`  
- 상품 상세: `href={`/inquiry?type=travel_consult&productId=${id}`}` + 스냅샷용 제목 props는 클라이언트에서 `fetch` 전 표시용으로만 쓰고, **제출 시 서버가 `Product`에서 다시 읽어 스냅샷** 저장 권장.

---

## 8. 관리자 수신 MVP 구현안

### 목록 컬럼

| 컬럼 | 소스 |
|------|------|
| 접수일시 | `createdAt` |
| 유형 | `inquiryType` |
| 상태 | `status` |
| 위험도 | `leadTimeRisk` (배지) |
| 신청인 | `applicantName` |
| 연락처 | `applicantPhone` |
| 스냅샷 상품 | `snapshotProductTitle` |
| 스냅샷 카드 | `snapshotCardLabel` |
| 연결 | `productId`, `monthlyCurationItemId` (링크) |

### 필터

- `inquiryType`, `status`, `leadTimeRisk` (쿼리스트링 또는 클라이언트 필터)

### 우선 확인

- 정렬: `leadTimeRisk` urgent→late→normal, 그다음 `createdAt` asc  
- 수동: 향후 `adminPriority` 컬럼 추가(2차)

### PATCH MVP

- `status` 만 변경 가능해도 충분.

---

## 9. 월별 큐레이션 MVP 구현안

- **데이터:** `MonthlyCurationItem` 수동 INSERT (또는 간단 POST 관리 API).  
- **공개 API:** `GET /api/curations/monthly?scope=domestic&yearMonth=2026-05`  
  - 기본값: `yearMonth` 없으면 **서버 기준 당월+2, +3** 중 published 있는 달 우선 또는 쿼리 필수로 단순화.  
- **draft / published:** `status === 'published' && isActive` 만 노출.  
- **국내/국외:** `scope` 로 분리; 메인에 두 섹션.

---

## 10. 메인페이지 연결 방식

### 구현 순서 (메인 내부)

1. 기존 Hero 유지 + `BongtourDisclosureBlock` `compact` 1회  
2. `MonthlyCurationSection` 제목 「○월 추천」+ `scope=domestic`  
3. 동일 구조 `scope=overseas`  
4. 카드 CTA → `/inquiry?type=...&curationItemId=...`  
5. `linkedProductId` 있으면 보조 링크 「연결 상품 상담」→ 동일 문의에 `productId` 포함 (쿼리 `productId` 추가)

### 카드 UI 계약 (필드 매핑)

| UI | 필드 |
|----|------|
| 제목 | `destinationName` + `oneLineTheme` (또는 theme만 강조) |
| 본문 | `whyNowText`, `recommendedForText` |
| 리드타임 | `leadTimeLabel` |
| 출처 배지 | `briefingSourceType` |
| 주 CTA | `primaryInquiryType` |

### 쇼핑몰 비유 방지

- 가격 미표시, “상담으로 안내” 고지, 카드에 `BongtourDisclosureBlock` 반복 생략 가능(섹션 상단 1회).

---

## 11. 2차 확장 예정 (구현 안 함)

- `product_curation_meta`, 배치 큐레이션 생성  
- Gemini 초안 필드·버전  
- `interpretation_mode_hint`, `vehicle_class_hint`  
- `lead_time_rule` 테이블 + 자동 `lead_time_risk`  
- 큐레이이션 관리자 풀 UI (에디터, 미리보기)  
- `monthly_curations` 부모 테이블·다중 아이템 그룹  
- 공급사 상품 자동 연결·점수화

---

## 12. 개발 태스크 체크리스트

- [ ] Prisma: `CustomerInquiry`, `MonthlyCurationItem`, `Product` 역관계  
- [ ] `npx prisma migrate dev`  
- [ ] `lib/bongtour-copy.ts` 작성  
- [ ] `BongtourDisclosureBlock`, `BongtourCtaButton`, `InquirySuccessPanel`  
- [ ] `POST /api/inquiries` — 검증(Zod)·스냅샷·`leadTimeRisk` 휴리스틱(희망월 없으면 `normal`)  
- [ ] `GET /api/curations/monthly`  
- [ ] `app/inquiry/page.tsx` + 4 폼 컴포넌트 + `InquiryFormShell`  
- [ ] `GET/PATCH /api/admin/inquiries` + `requireAdmin`  
- [ ] `app/admin/inquiries/page.tsx` + `AdminSidebar` 링크  
- [ ] `app/page.tsx` — 두 큐레이션 섹션 + 카드  
- [ ] 시드: `MonthlyCurationItem` domestic/overseas 각 1~2건  
- [ ] (선택) 상품 상세 CTA를 `/inquiry`로 연결

---

**참고:** SQLite 문자열 enum은 Prisma `enum` 대신 `String` + 앱 레벨 Zod 검증으로 통일해도 됨(기존 스키마 스타일과 일치).
