# 월별 큐레이션(`MonthlyCurationItem`) — MVP 시드·운영 안내 (P5)

공개 API: `GET /api/curations/monthly`  
관리 UI는 아직 없으므로 **Prisma Studio** 또는 **`scripts/seed-monthly-curations.ts`** 로 초기 데이터를 넣습니다.

---

## 1. Prisma Studio로 수동 입력

1. 프로젝트 루트에서 `npx prisma studio` 실행  
2. 모델 **`MonthlyCurationItem`** 선택 → **Add record**  
3. 아래 필드 채우기 (필수 문자열은 빈 값 없이)

| 필드 | 설명 |
|------|------|
| `yearMonth` | `YYYY-MM` (예: `2026-03`) |
| `scope` | `domestic` 또는 `overseas` |
| `destinationName` | 카드 제목에 가까운 목적지명 |
| `oneLineTheme` | 한 줄 테마 |
| `whyNowText` | 왜 지금인지 짧은 설명 |
| `recommendedForText` | 이런 분께 추천 |
| `leadTimeLabel` | 리드타임 안내 문구 (관리자 입력) |
| `primaryInquiryType` | `travel_consult` \| `institution_request` \| `overseas_training_quote` \| `bus_quote` |
| `briefingSourceType` | `supplier_based` \| `bongtour_editorial` \| `hybrid` |
| `linkedProductId` | 있으면 Prisma `Product.id` (cuid), 없으면 비움 |
| `sortOrder` | 같은 월·scope 내 정렬 (작을수록 앞) |
| `status` | 공개 노출 시 반드시 **`published`** |
| `isActive` | **`true`** |

**노출 조건:** API는 `status === 'published'` 이고 `isActive === true` 인 행만 반환합니다.

---

## 2. 시드 스크립트 (선택)

이미 **published** 큐레이션이 1건이라도 있으면 스크립트는 아무 것도 하지 않습니다.

```bash
npx tsx scripts/seed-monthly-curations.ts
```

`DATABASE_URL`은 `.env`와 동일하게 맞춥니다.

---

## 3. 샘플 데이터 예시 (4~6개)

동일 `yearMonth`로 국내 2~3개, 국외 2~3개를 넣으면 메인에서 섹션별로 나누어 부르기 좋습니다.

### 국내 `domestic`

**A — 제주 봄**

- `yearMonth`: `2026-04`
- `scope`: `domestic`
- `destinationName`: 제주
- `oneLineTheme`: 봄 햇살·노을 드라이브
- `whyNowText`: 4~5월 기온이 안정적이고 렌터카·숙소 선택지가 넓습니다.
- `recommendedForText`: 가족·커플, 짧은 휴가로 재충전하고 싶은 분
- `leadTimeLabel`: 성수기 전 주말은 3~4주 전 상담을 권장합니다.
- `primaryInquiryType`: `travel_consult`
- `briefingSourceType`: `bongtour_editorial`
- `sortOrder`: `0`

**B — 부산·경주 단기**

- `yearMonth`: `2026-04`
- `scope`: `domestic`
- `destinationName`: 부산·경주
- `oneLineTheme`: 바다와 역사 3박 4일
- `whyNowText`: 국내 단거리 이동 위주로 일정 설계가 유연합니다.
- `recommendedForText`: 첫 가족여행·어르신 동반
- `leadTimeLabel`: 주말 숙소는 2~3주 전부터 촉박해질 수 있습니다.
- `primaryInquiryType`: `travel_consult`
- `briefingSourceType`: `hybrid`
- `sortOrder`: `1`

**C — 강원 산·숲 (기관/단체 성격 예시)**

- `yearMonth`: `2026-05`
- `scope`: `domestic`
- `destinationName`: 강원
- `oneLineTheme`: 산림·웰니스 프로그램
- `whyNowText`: 단체 일정은 기관 일정에 맞춰 견적이 달라집니다.
- `recommendedForText`: 학교·기관 단체, 워크숍 견적이 필요한 담당자
- `leadTimeLabel`: 단체는 최소 4~6주 전 상담을 권장합니다.
- `primaryInquiryType`: `institution_request`
- `briefingSourceType`: `bongtour_editorial`
- `sortOrder`: `0`

### 국외 `overseas`

**D — 다낭**

- `yearMonth`: `2026-04`
- `scope`: `overseas`
- `destinationName`: 다낭
- `oneLineTheme`: 해변 리조트와 시내 맛집
- `whyNowText`: 직항·환승 옵션을 비교해 일정을 맞추기 좋은 시즌입니다.
- `recommendedForText`: 휴양 위주, 가족·친구 동반
- `leadTimeLabel`: 성수기 좌석·요금 변동이 잦아 4주 전 상담을 권장합니다.
- `primaryInquiryType`: `travel_consult`
- `briefingSourceType`: `supplier_based`
- `linkedProductId`: *(선택) 실제 `Product.id`가 있으면 입력*
- `sortOrder`: `0`

**E — 도쿄 비즈·연수 톤**

- `yearMonth`: `2026-05`
- `scope`: `overseas`
- `destinationName`: 도쿄
- `oneLineTheme`: 기업 벤치마킹·연수 일정
- `whyNowText`: 방문 기관·일정에 따라 견적과 서류가 달라집니다.
- `recommendedForText`: 기업·기관 연수 담당자
- `leadTimeLabel`: 비자·기관 섭외가 필요하면 8주 이상 여유를 권장합니다.
- `primaryInquiryType`: `overseas_training_quote`
- `briefingSourceType`: `hybrid`
- `sortOrder`: `0`

**F — 단체 버스(국내 출발 국외 일정 전후)**

- `yearMonth`: `2026-06`
- `scope`: `overseas`
- `destinationName`: 인천 ↔ 공항 연계
- `oneLineTheme`: 단체 항공 일정에 맞춘 차량
- `whyNowText`: 항공·단체 인원에 맞춰 차량 규격과 시간을 맞춥니다.
- `recommendedForText`: 학교·기관 단체, 전세 버스가 필요한 일정
- `leadTimeLabel`: 출발 3주 전까지 상담 완료를 권장합니다.
- `primaryInquiryType`: `bus_quote`
- `briefingSourceType`: `bongtour_editorial`
- `sortOrder`: `0`

위 예시 모두 **`status`: `published`**, **`isActive`: `true`** 로 저장해야 API에 노출됩니다.

---

## 4. API 호출 예시

- 국내 이번 달(데이터에 맞게 `yearMonth` 조정):  
  `GET /api/curations/monthly?scope=domestic&yearMonth=2026-04`
- 국외 전체(월 무관):  
  `GET /api/curations/monthly?scope=overseas`

---

## 5. 메인 카드 CTA (P6에서 연결)

- 문의 링크:  
  `/inquiry?type={inquiryPageKind}&monthlyCurationItemId={id}&snapshotCardLabel={encodeURIComponent(oneLineTheme)}&targetYearMonth={yearMonth}`  
  (`inquiryPageKind`는 API 응답 필드, `primaryInquiryType`에서 변환됨.)
- `linkedProductId`가 있으면 선택적으로 `/products/{id}` 링크를 추가할 수 있습니다 (P6 이후).

자세한 계약은 구현 계획서 및 `lib/monthly-curation.ts` 주석을 참고하세요.
