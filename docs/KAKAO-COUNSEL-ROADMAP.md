# 카카오 상담 유입 — 맥락 강화·유형 분기·운영 연계 로드맵

**요약 복사·dataLayer·`CounselIntent`는 `lib/kakao-counsel.ts` + `KakaoCounselCta`에 반영됨.**  
CRM/관리자 로그 **서버 저장은 아직 없음** — 아래는 확장 검토용이다.

---

## 1) 상담 유입 맥락 강화 (1순위 검토)

**목표**: 상품명·공급사(`originSource`)·선택 출발일·인원 구성이 상담 채널에서 바로 이어지도록 한다.

### 제약

- 카카오 **오픈채팅 링크만**으로는 채팅 입력창에 자동 삽입이 보장되지 않는다(플랫폼 정책).
- 따라서 **클라이언트에서 “복사 + 새 탭 열기”** 조합이 현실적인 1차 강화다.

### 방안 A — 상담 요약 문구(클립보드)

- `KakaoCounselCta` 클릭 시(또는 보조 버튼 “요약 복사 후 상담 열기”):
  - 고정 템플릿 예:
    - `[상담문의] 상품: {title} / 공급: {originSource} / 코드: {originCode} / 출발희망: {date} / 인원: 성인{n1} 아동(베드/노베드)… 유아…`
  - `navigator.clipboard.writeText` 성공 후 `window.open(KAKAO_OPEN_CHAT_URL, …)` (기존 `KakaoBookingButton` 패턴과 유사).
- 예약 접수 직후 성공 화면에서는 **접수 번호(`bookingId`)**를 요약에 포함할지 정책 결정(PII 최소화).

### 방안 B — URL 쿼리(UTM / 내부 추적용)

- `buildOpenChatUrl({ utm_source, utm_campaign, utm_content })` 형태로 `KAKAO_OPEN_CHAT_URL`에 쿼리만 부착.
- **오픈채팅 입장 UX에는 영향 없을 수 있음** — 분석(GA4 `page_view` 대신 `outbound` 이벤트)용으로만 쓰는 편이 안전.

### 방안 C — 이벤트 트래킹

- 상담 CTA 클릭 시: `dataLayer.push` 또는 `gtag('event', 'kakao_counsel_click', { product_id, … })`.
- 복사 성공/실패 여부를 `event` 파라미터로 구분.

### 권장 순서

1. 클립보드 요약(방안 A) — 운영 효과 즉시  
2. GA/데이터레이어 이벤트(방안 C) — 유입 측정  
3. UTM(방안 B) — 캠페인·A/B 시 필요 시

---

## 2) 상담 유형 분기 확장 (2순위 준비)

**목표**: UI에서 유형을 고르거나, 진입 경로로 유형을 암시해 향후 라우팅·통계에 쓸 수 있게 한다.

### 유형 후보(예시)

| 코드 | 설명 |
|------|------|
| `booking` | 예약·접수 관련 |
| `departure` | 출발일·좌석·일정 가능 여부 |
| `benefit` | 혜택·프로모·카드 |
| `schedule` | 일정표·쇼핑·선택관광 등 상품 설명 |

### 확장 포인트(코드 수준)

- `CounselIntent`는 `lib/kakao-counsel.ts`에 정의됨.
- `KakaoCounselCta`는 **`intent` 필수** — 혜택/일정 전용 UI가 생기면 **동일 컴포넌트**에 아래만 바꿔 연결하면 된다.

| 진입 | `intent` | `from_screen` (예약) |
|------|----------|----------------------|
| 혜택·프로모 섹션 | `benefit` | `product_detail_benefit_section` |
| 일정·쇼핑·선택관광 섹션 | `schedule` | `product_detail_schedule_section` |

나머지 props(`productId`, `originSource`, `pax` 등)는 상품 상세와 동일하게 넘기면 `dataLayer`·요약 문구가 자동으로 맞춰진다.

### 하지 않을 것(이번 로드맵)

- 카카오 OAuth·채널 봇·자동 분류 API.

---

## 3) 관리자/운영 로그 연계 — 확장 포인트만 (3순위, 비구현)

**지금은 구현하지 않는다.** 서버·DB에 상담 클릭을 저장하는 API/테이블은 **도입하지 않음**. 아래를 **정책·PII 검토 후** 별도 결정한다.

### 판단 게이트 (도입 전 체크리스트)

| 항목 | 메모 |
|------|------|
| 데이터 최소화 | GA4(+GTM)만으로 충분한지, 내부 로그가 **반드시** 필요한지 |
| PII | `product_id`, `origin_source`, `intent`, `from_screen`은 비식별에 가깝지만, 서버에 **사용자 식별자·세션·IP**를 함께 쌓을 경우 개인정보 처리방침·보존기간 검토 필요 |
| 동의/쿠키 | 측정 배너·동의 범위와 일치하는지 |
| 운영 목적 | CS 분배·콜백 연계 등 **목적**이 명확할 때만 DB 적재 검토 |

### 확장 아이디어 (문서만, 코드 없음)

| 영역 | 확장 아이디어 |
|------|----------------|
| 예약 접수 | `Booking.id`와 상담 클릭 시각을 같은 세션에서 상관 — 서버 로그 또는 `AssetUsageLog`와 유사한 **클라이언트 이벤트 로그** 테이블(선택) |
| 분석 | GA4 BigQuery → 대시보드에서 상담 클릭 대비 접수 전환 |
| CRM | 웹훅으로 `{ event, productId, intent, bookingId? }` 전송 — 제3자 도구 연동 |
| 관리자 | `/admin`에 “상담 유입 요약(일별 클릭 수)” — **이벤트만 쌓인 뒤** 의미 있음 |

개인정보: 클립보드 요약에 이름·전화를 넣지 않거나, 예약 완료 후에만 내부 참조용으로 제한.

---

## 4) 관련 코드 위치

- URL: `lib/kakao-open-chat.ts`
- CTA UI: `app/components/travel/KakaoCounselCta.tsx`
- 레거시(복사+열기): `app/components/detail/KakaoBookingButton.tsx`

---

## 5) 구현 현황 (1차)

- **요약 복사 + 오픈**: `lib/kakao-counsel.ts` — `buildKakaoCounselSummaryText`, `copyTextAndOpenKakaoOpenChat`
- **dataLayer**: `pushKakaoCounselDataLayer` — 이벤트명 `kakao_counsel_click`, 필드 `intent`, `product_id`, `origin_source`, `from_screen`
- **CounselIntent**: `booking` | `departure` | `benefit` | `schedule` — `KakaoCounselCta` 필수 prop
- **화면별**: 상품 상세 데스크톱·모바일 `departure` + `product_detail_*`, 예약 성공 모달 `booking` + `booking_success_modal`

GTM 컨테이너에서 `kakao_counsel_click` 트리거·태그로 GA4 이벤트로 전송한다.  
**단계별 설정·검증 체크리스트**: [`docs/GTM-KAKAO-COUNSEL-GA4.md`](./GTM-KAKAO-COUNSEL-GA4.md)

---

## 6) 남은 TODO

1. 혜택/일정 전용 진입 UI에서 `KakaoCounselCta` 배치 (`intent` + `from_screen`은 위 표 참고)  
2. **운영** GTM 게시 후 Tag Assistant·GA4 DebugView로 `kakao_counsel_click` 파라미터 4종 수신 확인 ([`GTM-KAKAO-COUNSEL-GA4.md`](./GTM-KAKAO-COUNSEL-GA4.md))  
3. (선택) 서버/스토리지 이벤트 로그 — §3 판단 게이트 통과 후에만 구현 검토
