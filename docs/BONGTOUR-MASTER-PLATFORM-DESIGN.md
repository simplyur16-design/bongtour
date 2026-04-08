# 봉투어 마스터 플랫폼 설계 (컨설팅 허브형)

**문서 버전:** 0.2 (기획·운영 기준 — 실무 필드·스냅샷·리스크 보강)  
**전제 데이터 3축:** `Product`(고정) · `ProductDeparture`(출발일별 변동) · `ItineraryDay`(일정 원문) — 역할 분리 유지.

---

## 1. 전체 구조 한 줄 요약

**공급사 상품 데이터는 그대로 두되**, 봉투어 **해석·큐레이션·리드타임·문의 라우팅 메타**를 별도 레이어로 쌓아 메인·상세·문의를 **“상담·설계·연결” 중심 UI**로 노출하고, **가격·출발일·식별·게시 확정은 어댑터·규칙·관리자 승인**이 담당한다.

---

## 2. 문의/견적 폼 필드 설계표

공통 저장 모델은 **단일 테이블 `CustomerInquiry`**(가칭)에 적재하고, `inquiry_type`으로 분기한다. (구현 시 Prisma 모델명은 팀 규칙에 따름.)

### 공통 필드 (4폼 공통, DB 컬럼 예시)

| DB 필드명 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `id` | cuid | 자동 | PK |
| `inquiry_type` | enum 문자열 | 예 | 아래 표 참조 |
| `status` | enum 문자열 | 예 | `received` → … |
| `submitted_at` | DateTime | 예 | 제출 시각 |
| `applicant_name` | String | 예 | 신청인 성함 |
| `applicant_phone` | String | 예 | 연락처 |
| `applicant_email` | String | 선택 | 이메일 |
| `preferred_contact_channel` | String | 선택 | `kakao` \| `phone` \| `email` |
| `privacy_agreed` | Boolean | 예 | 개인정보 동의 |
| `marketing_opt_in` | Boolean | 선택 | 선택 동의 |
| `source_page_path` | String | 선택 | 제출 페이지 경로 |
| `utm_json` | String? | 선택 | 캠페인 추적 JSON |
| `product_id` | String? | 조건부 | 공급사 상품 기반 문의 시 FK |
| `monthly_curation_item_id` | String? | 조건부 | 메인 월별 카드에서 유입 시 FK |
| `suggested_inquiry_types_json` | String? | 선택 | 큐레이션 엔진이 제안한 `inquiry_type` 후보 배열 JSON |
| `admin_priority` | Int | 기본 0 | 정렬용 (수동 상향) |
| `admin_assignee_user_id` | String? | 선택 | 담당자 |
| `admin_notes_internal` | String? | 선택 | 내부 메모 (고객 비노출) |
| `followup_kakao_sent_at` | DateTime? | 선택 | 카카오 발송 시각 |
| `followup_email_sent_at` | DateTime? | 선택 | 메일 발송 시각 |
| `followup_call_logged_at` | DateTime? | 선택 | 통화 기록 시각 |
| `snapshot_product_title` | String? | 조건부 | **제출 시점**의 상품명 스냅샷 (아래 §2.0 참조) |
| `snapshot_card_label` | String? | 조건부 | **제출 시점**의 메인/브리핑 **카드 제목·한 줄 헤드라인** 스냅샷 |
| `lead_time_risk` | String | 기본 `normal` | 상담 시점 대비 **운영 위험도 힌트** (§6.1·§5.7 참조) |

#### §2.0 문의 시점 스냅샷 (`snapshot_*`) — 운영 추적

| 질문 | 답 |
|------|-----|
| **왜 필요한가** | `Product.title`·큐레이션 카드 카피는 **승인 후에도 변경**될 수 있다. 문의 당시 고객이 본 문구와 나중의 DB 현재값이 달라지면 **CS·분쟁·내부 재현**이 어렵다. |
| **언제 채우는가** | 폼 제출 핸들러에서 **항상** 시도: 상품 기반이면 `snapshot_product_title` = 당시 `Product.title`; 월별 카드·브리핑에서 왔으면 `snapshot_card_label` = 당시 카드 `theme_one_liner` 또는 관리자가 지정한 카드 헤드라인. 둘 다 해당되면 **둘 다** 저장. |
| **목적** | FK(`product_id`, `monthly_curation_item_id`)는 **연결**, 스냅샷은 **당시 화면 문구 증거**. |
| **일반 여행 상담** | `product_id` 있음 → `snapshot_product_title` **필수 권장**. 카드 경로 유입 시 `snapshot_card_label` 추가. |
| **월별 큐레이션 문의** | `monthly_curation_item_id` 있음 → `snapshot_card_label` **필수 권장** + (연결 상품 있으면) `snapshot_product_title` 선택. |
| **예시 일정 브리핑 문의** | 브리핑이 별도 카드/앵커면 해당 카드의 노출 제목을 `snapshot_card_label`에 저장. 상품 동시 노출 시 `snapshot_product_title` 병행. |

> `snapshot_curation_title` 명칭이 내부 용어로 더 익숙하면 **동의어**로 쓰되, DB 컬럼은 **`snapshot_card_label` 하나로 통일**해 중복을 피한다.

#### `lead_time_risk` 값 (고정 집합)

| 값 | 의미(관리자 목록) |
|----|-------------------|
| `normal` | 권장 상담 시작 시점 대비 **여유** 또는 정보 부족으로 중립 |
| `late` | 희망 출발/대상월 대비 **상담이 늦은 편** — 우선 연락 검토 |
| `urgent` | 성수기·기관 섭외·대규모 단체 등 **준비 기간 촉박** — 최우선 검토 |

**산출:** 규칙 엔진이 `wish_departure_month` / `target_month` / `lead_time_rule` 범위와 **오늘**을 비교해 계산(§5.7). 자동 확정이 아닌 **힌트**이며, 관리자가 `admin_priority`로 덮어쓸 수 있다.

### `inquiry_type` 값 (고정 집합)

| 값 | 한글 표기(관리자 UI) |
|----|----------------------|
| `travel_consult` | 일반 여행 상담·예약신청 |
| `institution_request` | 연수기관 섭외 문의 |
| `overseas_training_quote` | 국외연수 견적 문의 |
| `bus_quote` | 전세버스 견적 문의 |

### `status` 값 (고정 집합)

| 값 | 의미 | 고객 노출 |
|----|------|-----------|
| `received` | 접수 완료 | “접수되었습니다” |
| `reviewing` | 내부 검토 중 | 일반적으로 비노출 |
| `contacted` | 고객 연락 진행 | 선택적 안내 |
| `quoted` | 견적 안내 완료(해당 유형) | 유형별 문구 |
| `scheduled` | 일정/방문 확정 등 다음 단계 | 유형별 문구 |
| `closed` | 종결 | “해당 건은 종료되었습니다” 등 |
| `dropped` | 무효/중복/고객 취하 | 내부만 |

---

### A. 일반 여행 상담/예약신청 폼

| 항목 | 내용 |
|------|------|
| **폼 목적** | 공급사 상품 기반 **상담·예약신청 접수** (즉시 결제 확정 아님) |
| **권장 폼명** | 「이 상품 상담·예약 신청」 / 「맞춤 상담 신청」 |
| **주요 시나리오** | 상품 상세·월별 추천 카드·검색 결과에서 유입 후 희망일·인원 문의 |
| **필수 필드** | 성함, 휴대폰, 개인정보 동의, (상품 기반 시) 상품 식별 — UI는 제목 표시, 저장은 `product_id` |
| **선택 필드** | 이메일, 선호 연락 채널, 희망 출발월·일(텍스트 또는 월 선택), 성인/아동 인원, 요청사항, 단체 여부 |
| **내부 저장 필드명** | `product_id`, `wish_departure_month` (String `YYYY-MM` 선택), `wish_departure_note`, `pax_adult`, `pax_child`, `request_body` (자유기술), `pricing_ack_text` (고지 동의 체크 시각/버전 id) |
| **inquiry_type** | `travel_consult` |
| **연결 방식** | FK `product_id` → `Product.id` ; 선택적으로 `monthly_curation_item_id` (메인 카드 경로) |
| **사용자 안내 문구** | “봉투어는 **상담·접수 창구**입니다. 예약 확정은 **공급사 일정·좌석 확인 후** 안내드립니다.” |
| **제출 완료 문구** | “상담·예약 신청이 접수되었습니다. 담당자가 순차적으로 연락드립니다.” |
| **오인 방지 문구** | “본 신청은 **결제 완료가 아니며**, 최종 조건은 상담 후 확정됩니다.” |
| **관리자 우선 확인** | `Product.originSource`·`originCode`, 희망 시기, 인원, 동시 문의 중복 전화번호 |

---

### B. 연수기관 섭외 문의폼

| 항목 | 내용 |
|------|------|
| **폼 목적** | **목적지 관광**보다 **방문 희망 기관·분야·일정 목적** 중심 접수 |
| **권장 폼명** | 「연수·기관 방문 섭외 문의」 |
| **주요 시나리오** | 학교·기업·협회 등 기관 단위, 현지 기관 네트워킹·견학 |
| **필수 필드** | 성함, 휴대폰, 개인정보 동의, **희망 분야/기관 유형**(텍스트), **방문 목적**(한 줄) |
| **선택 필드** | 이메일, 선호 연락 채널, 희망 국가·도시, 희망 시기(월), 예상 인원 규모, 통역 필요 여부(체크), 기존 공급사 상품 연계 희망(`product_id` 선택) |
| **내부 저장 필드명** | `institution_field_or_type`, `visit_purpose_one_liner`, `target_region_note`, `expected_group_size_band` (`small`/`medium`/`large`), `interpretation_needed` (Boolean), `product_id` (nullable) |
| **inquiry_type** | `institution_request` |
| **연결 방식** | `product_id` 선택 시 상품과 **약한 연결**(기관 일정이 상품 일정과 다를 수 있음) — 관리자 UI에 “상품 참고만” 배지 |
| **사용자 안내 문구** | “구체 기관 확정은 **현지 사정·일정에 따라** 상담을 통해 단계적으로 진행됩니다.” |
| **제출 완료 문구** | “연수·기관 섭외 문의가 접수되었습니다. 담당자가 요청 내용을 검토 후 연락드립니다.” |
| **오인 방지 문구** | “특정 기관 방문이 **항상 가능함을 보장하지 않으며**, 상담을 통해 가능 범위를 안내합니다.” |
| **관리자 우선 확인** | 분야·목적·시기·인원·통역 필요, (있으면) 연계 `Product` |

---

### C. 국외연수 견적 문의폼

| 항목 | 내용 |
|------|------|
| **폼 목적** | **프로젝트 브리프** 수준 정보 수집 후 견적·일정 설계 착수 |
| **권장 폼명** | 「국외연수·단체 프로그램 견적 문의」 |
| **주요 시나리오** | 다일정·다지역·강사·숙박·현지 이동 포함 연수 |
| **필수 필드** | 성함, 휴대폰, 동의, **주최(기관명)**, **프로그램 목적**, **희망 기간(시작~종료 대략 또는 일수)**, **예상 인원** |
| **선택 필드** | 이메일, 선호 채널, 희망 국가·도시(복수 태그), 숙박 등급 희망, 항공 포함 여부, 통역(순차/동시) 필요 여부, 식사·현지 이동 요구, 참고 상품(`product_id`), 첨부 요청(추후 링크) |
| **내부 저장 필드명** | `org_name`, `program_goal`, `duration_note`, `pax_estimate`, `destinations_tags_json`, `lodging_pref`, `flight_included_pref`, `interpretation_mode_pref` (`none`/`consecutive`/`simultaneous`), `bus_needed` (Boolean), `brief_freeform`, `product_id` |
| **inquiry_type** | `overseas_training_quote` |
| **연결 방식** | `product_id`는 **레퍼런스**; 실제 일정은 커스텀 견적 트리거 |
| **사용자 안내 문구** | “견적은 **제출 정보를 바탕으로** 산정하며, 현지 비용 변동에 따라 조정될 수 있습니다.” |
| **제출 완료 문구** | “국외연수 견적 문의가 접수되었습니다. 브리프 검토 후 담당자가 연락드립니다.” |
| **오인 방지 문구** | “접수만으로 **견적 금액이 확정되지 않습니다.**” |
| **관리자 우선 확인** | 기간·인원·통역·버스·목적지, 레퍼런스 상품 여부 |

---

### D. 전세버스 견적 문의폼

| 항목 | 내용 |
|------|------|
| **폼 목적** | **차량·운행** 중심 견적 브리프 (여행 상품과 분리) |
| **권장 폼명** | 「전세버스·단체 이동 견적 문의」 |
| **주요 시나리오** | 국내 이동, 공항 픽업, 일정 구간 반복 운행 |
| **필수 필드** | 성함, 휴대폰, 동의, **운행 일자(또는 기간)**, **승차·하차 지역(텍스트)**, **예상 인원** |
| **선택 필드** | 이메일, 차량 규모 희망, 왕복/편도, 시간대 제약, 경유지, 유아·휠체어 동반, 여행 상품과 연계 여부(`product_id`) |
| **내부 저장 필드명** | `service_date_or_range`, `pickup_area`, `dropoff_area`, `pax_estimate`, `vehicle_class_pref`, `trip_type` (`oneway`/`round`/`multi`), `waypoints_note`, `product_id` |
| **inquiry_type** | `bus_quote` |
| **연결 방식** | `product_id` 선택 시 “여행 일정과 버스 견적 **동시 검토**” 플래그 표시 |
| **사용자 안내 문구** | “봉투어 **직영 전세버스 운영** 기준으로 견적을 검토합니다(일정·거리에 따라 변동).” |
| **제출 완료 문구** | “전세버스 견적 문의가 접수되었습니다. 운행 조건 확인 후 연락드립니다.” |
| **오인 방지 문구** | “차량 배정·요금은 **도로·법규·일정**에 따라 달라질 수 있습니다.” |
| **관리자 우선 확인** | 일자·구간·인원·차량급, 여행 상품 연계 여부 |

---

## 3. 메인페이지 연결 방식

### 3.1 섹션 구성과 역할

| 순서 | 섹션 | 역할 | 데이터 소스(초안) |
|------|--------|------|-------------------|
| 1 | Hero | 컨설팅 허브 포지션 + 1차 CTA | 정적 카피 + `primary_cta_inquiry_types` 링크 |
| 2 | 공급사 관계/신뢰 구분 | “공급사 상품 **상담 창구**” 명시, 로고는 보조(회색/텍스트) | 정적 + `Brand` 메타(텍스트명 우선) |
| 3 | 월별 추천 여행 | **국내편 / 국외편** 탭 | `MonthlyCuration` + `MonthlyCurationItem` (게시 승인분만) |
| 4 | 예시 일정·큐레이션 브리핑 | 카드 2~4개, “왜 지금/누구/어떻게 돕는지”; **출처 배지**(`briefing_source_type`) | `MonthlyCurationItem.briefing_*` |
| 5 | 봉투어 핵심 강점 | 기관 섭외 · 순차/동시통역 · 직영 버스 | 정적 + 앵커 링크 |
| 6 | 문의 유형 선택 | 4분기 카드 → 각 폼 딥링크 | `inquiry_type` 쿼리 `?type=...` |
| 7 | 상담 CTA | 반복 CTA (중복 허용, 피로도 낮은 문구) | 동일 |
| 8 | 푸터 고지 | 법적·오인방지 | 정적 |

### 3.2 공급사 상품 노출 방식 (구조적 장치)

| 요소 | 방식 |
|------|------|
| **1차 노출** | **큐레이션 카드** = 봉투어 해석 필드(테마·이유·대상·리드타임·CTA) **먼저** |
| **2차 노출** | 카드 하단 **“연결된 상품 상담”** = `Product.title` + `originSource` **텍스트** + `상담 신청`( `product_id` 전달) |
| **직접 쇼핑몰 그리드** | 메인 **비권장**; 검색/목록은 별도 IA에서 “상담 중심” 카드 템플릿 재사용 |
| **가격** | 메인 카드에 **최저가 강조 금지**; 필요 시 “상담 시 안내” 문구만 |

### 3.3 통역·버스·기관 섭외 노출

| 주제 | 메인 처리 |
|------|-----------|
| 기관 직접 섭외 | 강점 섹션에 **불릿 + `institution_request` 폼 링크** |
| 순차통역 | 짧은 정의 + “동시대비 비용·적합 상황” 한 줄 + 예시 |
| 동시통역 | 장비·인력 동반 전제 명시, **동시 vs 순차 비교 표**(2행) |
| 전세버스 | “직영 운영” 문구 + `bus_quote` CTA |

### 3.4 문의 유형 분기 UI

| UI 패턴 | 설명 |
|---------|------|
| 4카드 그리드 | 각 카드: 제목 1줄 + 설명 2줄 + `문의하기` → `/inquiry?type=travel_consult` 등 |
| Sticky 미니 바 | 스크롤 후에도 “문의 유형 선택” 접근 (모바일 하단) |

---

## 4. 월별 국내/국외 큐레이션 자동화 설계

### 4.1 추천 타깃월 계산 (기본 규칙)

| 규칙 ID | 설명 | 산출 |
|---------|------|------|
| `TARGET_MONTH_DEFAULT` | 기본 노출 대상월 | `today + 2개월`, `today + 3개월` 의 `YYYY-MM` |
| `TARGET_MONTH_EXTENDED` | 고복잡도 후보 | 위 + `today + 4개월` (플래그 `allow_plus4=true` 인 후보만) |
| `SEGMENT` | 국내/국외 | `domestic` \| `overseas` |

**저장 필드 예:** `MonthlyCuration.target_month` (String `YYYY-MM`), `segment` (`domestic` \| `overseas`).

### 4.2 후보 생성 → 검수 → 게시 파이프라인

```
Product(registered) + ProductDeparture + ItineraryDay
        ↓ 규칙 기반 필터 + 점수
monthly_curation_candidates (draft)
        ↓ Gemini: 카피 초안만
        ↓ (같은 행에 gemini_draft_json 병합)
        ↓ 관리자 UI 검수
monthly_curation_items (approved | rejected)
        ↓ 승인된 것만
메인 API: GET /curations?segment=&visible_month=
```

| 단계 | 자동/수동 |
|------|-----------|
| 후보 풀 생성 | **자동** (일배치 또는 상품 승인 시 트리거) |
| 국내/국외 분류 | **자동** 초안 + 관리자 **수정 가능** |
| 카드 카피 | **Gemini 초안** + 관리자 **필수 승인** |
| 공급사 상품 연결 | **자동 후보** (`product_id`) + 관리자 **확정** |
| 메인 노출 | **관리자 승인 후에만** `is_published=true` |

### 4.3 메인 노출 카드 필수 필드 (UI 계약)

| 필드 키 | DB/캐시 필드명 예 | 필수 |
|---------|-------------------|------|
| 지역명 | `region_label` | 예 |
| 한 줄 테마 | `theme_one_liner` | 예 |
| 지금 가기 좋은 이유 | `why_now` | 예 |
| 추천 대상 | `audience_label` | 예 |
| 권장 상담 시점 | `lead_time_display_text` | 예 |
| CTA 문구 | `cta_label` | 예 |
| 연결 상품 상담 | `linked_product_id` | 선택(있으면 버튼 표시) |
| 문의 유형 추천 | `suggested_inquiry_types_json` | 선택 |
| **메인 CTA용 대표 문의 유형** | `primary_inquiry_type` | 예 |
| 세그먼트 | `segment` | 예 |
| 대상월 | `target_month` | 예 |
| 브리핑 출처 구분 | `briefing_source_type` | 예 (§4.3.1) |

#### §4.3.1 `primary_inquiry_type` vs `suggested_inquiry_types_json`

| 구분 | 역할 |
|------|------|
| `suggested_inquiry_types_json` | **후보 배열** (예: `["travel_consult","institution_request"]`) — Gemini·규칙이 넓게 제안, 관리자가 다중 유지 가능. |
| `primary_inquiry_type` | **메인 카드 1개의 기본 CTA**가 열 폼의 `inquiry_type` — 사용자가 한 번에 이해할 **단일 행동**. |

**유형별 예시 (승인 시 관리자가 확정):**

| 카드 성격 | `primary_inquiry_type` 예시 |
|-----------|------------------------------|
| 일반 패키지 상담 | `travel_consult` |
| 기관 방문·견학 강조 | `institution_request` |
| 연수·단체 프로그램 강조 | `overseas_training_quote` |
| 이동·버스 연계 강조 | `bus_quote` |

**연결:** 카드의 메인 버튼 → `/inquiry?type={primary_inquiry_type}&curation_item_id=…` ; 보조 링크만 `suggested_inquiry_types_json`의 나머지를 노출.

#### §4.3.2 `briefing_source_type` (예시 일정·브리핑 출처)

| 값 | 의미 | 고객 오인 방지 |
|----|------|----------------|
| `supplier_based` | **공급사 ItineraryDay·원문** 인용·요약이 중심 | “일정은 **공급사 안내 기준**이며 변경될 수 있습니다” 고지 병행 |
| `bongtour_editorial` | **봉투어 편집·해석**만 (해당 시 ItineraryDay는 참고용 링크) | “아래는 **봉투어가 상담용으로 정리한 예시**입니다” |
| `hybrid` | 원문 일부 + 봉투어 해석 병기 | 카드에 **두 문단 분리** + 출처 배지 |

**메인/상세:** 카드·브리핑 블록 상단에 `briefing_source_type`에 대응하는 **짧은 고지 한 줄**을 템플릿으로 고정.

### 4.4 후보 선정 점수 요소 (규칙 엔진 입력)

| 요소 | 필드/소스 예 | 용도 |
|------|--------------|------|
| 월 적합 | `ProductDeparture.departureDate` 집계 vs `target_month` | 가용 출발일 존재 |
| 국내/국외 | `primaryRegion` / 목적지 규칙 테이블 | `segment` |
| 계절 | 월·지역 테이블 | 가점 |
| 여행 성격 | `themeTags`, `displayCategory` | 매칭 |
| 봉투어 적합도 | 기관/통역/버스 플래그(`product_curation_meta`) | 가점 |
| 단체 적합도 | `targetAudience`, `minPax` 등 | 가점 |

---

## 5. 권장 상담 시작 시점(Lead Time) 설계

### 5.1 목적

- **“예약 확정 데드라인”이 아님** → **“상담을 시작하면 좋은 시점”** 을 권장형 문구로 노출.

### 5.2 기본 테이블 초안: `lead_time_rule` (범위형 중심)

운영자는 실무에서 **“출발 1~2개월 전쯤 상담 권장”**처럼 **구간**으로 이해한다. 단일 정수(`base_weeks_before_departure`)만 두면 엣지 케이스마다 행을 쪼개야 하고, 카드·폼·관리자 화면에서 **동일 규칙을 다른 표현으로 쓰기** 어렵다. 따라서 **주 단위 min/max**를 SSOT로 둔다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | |
| `region_bucket` | String | `japan_near` \| `europe` \| `domestic` \| `sea` \| `default` |
| `travel_kind` | String | `general` \| `family` \| `group` \| `training` \| `institution` |
| `complexity_tier` | Int | 0=일반, 1=통역/기관, 2=통역+버스+다지역 |
| `base_weeks_min` | Int | 출발일 기준 **상담 시작 권장** 주간 범위 하한(주 전) |
| `base_weeks_max` | Int | 동일 상한 |
| `peak_extra_weeks_min` | Int | 성수기/연휴 가산 범위 하한 |
| `peak_extra_weeks_max` | Int | 성수기/연휴 가산 범위 상한 |
| `active` | Boolean | true |

**예시 행(운영에서 조정):**

| region_bucket | travel_kind | complexity_tier | base_weeks_min | base_weeks_max | peak_extra_weeks_min | peak_extra_weeks_max |
|---------------|-------------|-----------------|----------------|----------------|------------------------|-------------------------|
| japan_near | general | 0 | 4 | 8 | 1 | 2 |
| europe | general | 0 | 8 | 12 | 2 | 3 |
| europe | training | 2 | 12 | 16 | 2 | 4 |
| domestic | group | 0 | 3 | 6 | 0 | 2 |

**메인 카드 / 폼 / 관리자 장점:** 동일 행으로 **“약 N주 전”**(중앙값)·**“N~M주 전”**(범위 문구)·관리자 툴팁(“최소 주수 미만이면 late”)을 일관 생성한다.

**문구 생성 예:** `lead_time_display_text` = 템플릿 또는 Gemini 초안에  
`(base_weeks_min, base_weeks_max)`를 넣어 **“출발 약 1~2개월 전부터 상담을 권장합니다”** 형태로 변환(주→개월은 반올림 규칙을 별도 상수로 고정).

### 5.3 보정 로직 (의사코드)

```
(base_min, base_max) = rule_base_weeks_range(region_bucket, travel_kind, complexity_tier)
if peak_season(target_month):
  base_min += peak_extra_weeks_min(rule)
  base_max += peak_extra_weeks_max(rule)
# 카드 노출용 문구 (규칙 엔진이 숫자 SSOT, 문장은 템플릿 또는 Gemini 초안)
lead_time_display_text = format_range_weeks_or_months(base_min, base_max, target_month)
# 문의 접수 시 CustomerInquiry.lead_time_risk 계산에 사용 (§5.7)
```

### 5.4 자연어 문구 생성 역할 분담

| 구분 | 담당 |
|------|------|
| 주수·규칙 매칭 | **규칙 엔진** |
| 문장 다듬기·톤 | **Gemini 초안** (관리자 승인 전까지 노출 시에는 **승인된 문구**만) |
| 카드에 표시 | `MonthlyCurationItem.lead_time_display_text` |

### 5.5 `inquiry_type` 추천 연결

| 조건 | 추천 `inquiry_type` |
|------|---------------------|
| `complexity_tier >= 1` + 기관 키워드 | `institution_request` 후보 |
| `travel_kind = training` | `overseas_training_quote` 후보 |
| `bus_flag` | `bus_quote` 후보 |
| 그 외 | `travel_consult` |

저장: `suggested_inquiry_types_json` = `["travel_consult","institution_request"]` (우선순위 순). 메인 카드 게시 시 **`primary_inquiry_type`** 을 반드시 1개 지정(§4.3.1).

### 5.6 노출 예시 문구

- “**출발을 2~3개월 뒤**로 생각 중이시라면, **지금 상담을 시작**하시면 일정·좌석 여유를 함께 검토하기 좋습니다.”
- “**기관 방문·연수**가 포함될 수 있어, **출발 3~4개월 전**부터 준비하시길 권장합니다.”

### 5.7 `lead_time_risk` 산출 (문의 접수·관리자 목록)

| 입력 | 예 |
|------|-----|
| 고객 희망 출발/월 | `wish_departure_month`, 또는 큐레이션 `target_month` |
| 오늘 | 서버 시각 기준 |
| 매칭된 규칙 | `lead_time_rule` 행의 `base_weeks_*` (+ `peak_extra_weeks_*` 가산) |

**의사 로직 (힌트):**

- 희망 출발일(또는 해당 월 1일)까지 남은 주수 = `weeks_until`.
- 권장 상담 시작 **최소 주 전** = `base_weeks_min` (+ peak 가산).
- `weeks_until <= base_weeks_min` → **`urgent`** (이미 권장 시점을 지났거나 막바지).
- `weeks_until <= base_weeks_max` → **`late`** (권장 구간의 상한에 근접).
- 그 외 → **`normal`**.

**복잡도 가산:** `complexity_tier >= 1` 또는 `inquiry_type` in (`institution_request`, `overseas_training_quote`)이면 한 단계 위험도 상향 검토(예: `late`→`urgent`). 대규모 단체·버스 연계 플래그 시 동일.

**정렬:** 관리자 목록 기본 정렬에 `lead_time_risk` 가중치(`urgent` > `late` > `normal`) + `submitted_at`.

---

## 6. 관리자 수신/처리 구조

### 6.1 목록 컬럼 (권장)

| 컬럼 | 필드 |
|------|------|
| 접수일시 | `submitted_at` |
| 유형 | `inquiry_type` |
| 상태 | `status` |
| 신청인 | `applicant_name` |
| 연락처 | `applicant_phone` |
| 연결 상품 | `product_id` → **현재** `Product.title` (툴팁: `snapshot_product_title`과 다르면 배지 “제출 시점 문구와 상이”) |
| 연결 큐레이션 | `monthly_curation_item_id` + `snapshot_card_label` |
| 대상월 | `inquiry_payload.target_month` 또는 카드에서 역참조 |
| **상담 시점 위험도** | `lead_time_risk` (`normal` / `late` / `urgent`) — 색상·아이콘으로 강조 |
| 우선순위 | `lead_time_risk` 가중 → `admin_priority` DESC → `submitted_at` ASC |

### 6.2 필터·뷰

| 뷰 이름 | 필터 |
|---------|------|
| 상품 기반 | `product_id IS NOT NULL` |
| 프로젝트형 | `inquiry_type IN ('overseas_training_quote','bus_quote','institution_request')` |
| 미연락 | `status = 'received'` |

### 6.3 상품 vs 프로젝트 구분

| 구분 | 조건 |
|------|------|
| 상품 기반 | `product_id NOT NULL` |
| 프로젝트형 | `product_id NULL` 이거나 `inquiry_type != travel_consult` |

---

## 7. 큐레이션 엔진 설계

### 7.1 입력 데이터

| 소스 | 사용 필드 (예) |
|------|----------------|
| Product | `title`, `primaryDestination`, `primaryRegion`, `themeTags`, `targetAudience`, `duration`, `originSource`, `supplierGroupId` |
| ProductDeparture | 출발 월 분포, `statusRaw` 요약(가용성 힌트) |
| ItineraryDay | 도시 리스트, `rawBlock` 길이(일정 풍부도) — **요약 입력만**, 임의 일차 생성 금지 |

### 7.2 처리 영역 3분할

| 영역 | 처리 내용 |
|------|-----------|
| **규칙 기반** | 국내/국외, `target_month` 후보, 후보 점수, `lead_time` 주수, `product_id` 연결 후보, **금지: 식별·가격·출발일 확정** |
| **Gemini** | 테마·이유·대상 문구·브리핑·문의유형 후보·통역/버스 **가능성 설명 초안** |
| **관리자** | 모든 **게시 문구·연결·최종 카드 승인** |

### 7.3 중간 저장 테이블 초안

#### `product_curation_meta` (상품 단위 누적 메타)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | PK |
| `product_id` | String | FK Product, unique |
| `domestic_overseas_guess` | String | `domestic` \| `overseas` \| `unknown` |
| `travel_style_tags_json` | String | 자동 태그 |
| `audience_guess_json` | String | 자동 |
| `complexity_tier_guess` | Int | 0~2 |
| `interpretation_likelihood` | Float | 0~1 (추정 점수) |
| `interpretation_mode_hint` | String | `none` \| `consecutive` \| `simultaneous` \| `review_needed` — **자동 확정 아님**; 규칙+Gemini 초안+관리자 검수 |
| `bus_fit_likelihood` | Float | 0~1 |
| `vehicle_class_hint` | String | `large_bus` \| `premium_bus` \| `mini_bus` \| `staria` \| `review_needed` — **자동 확정 아님**; 규칙+검수 보조 |
| `institution_fit_likelihood` | Float | 0~1 |
| `gemini_last_draft_at` | DateTime? | |
| `admin_last_reviewed_at` | DateTime? | |
| `version` | Int | 낙관적 잠금용 |

#### `monthly_curation_candidates`

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | |
| `target_month` | String | `YYYY-MM` |
| `segment` | String | `domestic` \| `overseas` |
| `product_id` | String | FK |
| `rule_score` | Float | |
| `status` | String | `draft` \| `promoted` \| `discarded` |

#### `monthly_curations` (월·세그먼트 단위 묶음)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | |
| `target_month` | String | |
| `segment` | String | |
| `title_internal` | String | 관리용 |
| `is_published` | Boolean | |
| `published_at` | DateTime? | |

#### `monthly_curation_items` (메인 카드 1장 = 1행)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | |
| `monthly_curation_id` | String | FK |
| `sort_order` | Int | |
| `region_label` | String | |
| `theme_one_liner` | String | |
| `why_now` | String | |
| `audience_label` | String | |
| `lead_time_display_text` | String | |
| `cta_label` | String | |
| `linked_product_id` | String? | FK |
| `suggested_inquiry_types_json` | String? | 후보 배열 JSON |
| `primary_inquiry_type` | String | 메인 CTA 1개 — `inquiry_type` 값과 동일 집합 |
| `briefing_excerpt` | String? | 예시 일정 브리핑 요약 |
| `briefing_source_type` | String | `supplier_based` \| `bongtour_editorial` \| `hybrid` |
| `interpretation_mode_hint` | String? | 카드 단위 **오버라이드** 가능; 없으면 `product_curation_meta` 상속 |
| `vehicle_class_hint` | String? | 카드 단위 오버라이드; 없으면 meta 상속 |
| `approval_status` | String | `pending` \| `approved` \| `rejected` |
| `approved_by_user_id` | String? | |
| `approved_at` | DateTime? | |

#### §7.3.1 통역·버스 힌트 필드 운영 연결

**`interpretation_mode_hint`**

| 값 | 메인/카드 | 폼·문의 | 관리자 |
|----|-----------|---------|--------|
| `none` | “통역 별도 필요 없을 수 있음” 수준의 부가 문구만 | 기본 | 검수 시 변경 가능 |
| `consecutive` | 순차통역 적합 맥락 **소개 문구** 슬롯 | 국외연수·기관 폼에 **권장 옵션** 프리필(강제 아님) | `overseas_training_quote` / `institution_request` 우선 검토 |
| `simultaneous` | 동시통역(장비·인력) 전제 **안내** | 동일 | 견적·일정 여유 `lead_time_risk` 상향 참고 |
| `review_needed` | 카드에 “통역 방식은 상담 시 확정” 고지 | 자유 서술 유도 | 담당자 확인 필수 |

- **성격:** 규칙(키워드·지역·인원)이 1차 후보를 주고, **Gemini는 설명 문장 초안**, **관리자가 게시 전 확정**. 자동 확정 아님.

**`vehicle_class_hint`**

| 값 | 전형 시나리오 |
|----|----------------|
| `large_bus` | 학교·단체 대규모, 국내 이동 위주 |
| `premium_bus` | 워크숍·기관 일정, 좌석·이미지 중시 |
| `mini_bus` | 소규모 그룹 구간 이동 |
| `staria` | VIP·소수, 공항 픽업 등 |
| `review_needed` | 인원·노선이 애매할 때 |

- **연결:** `bus_quote` 폼의 `vehicle_class_pref`와 **같은 값 집합**을 공유하면 자동 프리필·툴팁에 유리. 역시 **규칙 + 검수**; 최종 배차는 운영 확정.

#### `inquiry_routing_meta` (문의 접수 시 라우팅 근거)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | cuid | |
| `customer_inquiry_id` | String | FK |
| `routing_reason_json` | String | 어떤 규칙/Gemini 힌트로 분기 추천됐는지 |

> **스냅샷 문구 SSOT는 `CustomerInquiry.snapshot_*`** (§2.0). 본 테이블은 “왜 이 유형으로 라우팅되었는지”만 최소 기록해 중복을 피한다.

### 7.4 자동 확정 금지 목록 (재확인)

`originCode`, `supplierGroupId`, `supplierDepartureCode`, 가격, 출발일, 좌석, 예약상태, 계약 관계, 최종 게시 — **전부 어댑터·관리자 영역**.

---

## 8. 제미나이 역할 정의

### 8.1 해야 할 일 (A)

| # | 작업 | 출력 형식 |
|---|------|-----------|
| 1 | 상품 해석 요약 | 관리자 검수용 초안 텍스트 |
| 2 | 여행 성격 분류 보조 | 태그 후보 JSON |
| 3 | 추천 대상 문구 | 1~2문장 |
| 4 | 한 줄 테마 | 40자 내외 |
| 5 | 지금 가기 좋은 이유 | 2~4문장 |
| 6 | 예시 일정 브리핑 | 불릿/단락 (ItineraryDay **원문 인용** 요청 시에만) |
| 7 | 권장 상담 시점 설명 | 규칙이 준 주수를 자연어로 |
| 8 | 문의 유형 연결 후보 | `inquiry_type` 배열 |
| 9 | 연수기관 섭외 연계 가능성 설명 | 조건부 문장 |
| 10 | 순차/동시통역 맥락 설명 | 비교 설명 초안 |
| 11 | 버스 연계 가능성 설명 | 조건부 문장 |
| 12 | 메인 카드 카피 초안 | 카드 필드별 JSON |
| 13 | `interpretation_mode_hint` / `vehicle_class_hint` 후보 | 값은 **제안**만; 최종은 관리자 |
| 14 | `briefing_source_type` 제안 | `supplier_based` / `bongtour_editorial` / `hybrid` 중 초안 |

### 8.2 하면 안 되는 일 (B)

| # | 금지 |
|---|------|
| 1 | `originCode` / `supplierGroupId` / `supplierDepartureCode` 확정 출력 |
| 2 | 출발일·가격·좌석·상태 수치 확정 |
| 3 | “예약 확정되었습니다” 류 확정 문구 |
| 4 | 최종 게시 자동 승인 |
| 5 | 공급사와의 법적 관계 단정 |
| 6 | 실제 가능 여부 단정(“반드시 방문 가능”) |

### 8.3 3단 역할 분리 표

| 작업 유형 | 규칙 기반 | Gemini | 관리자 |
|-----------|-----------|--------|--------|
| 식별·가격·출발일 동기화 | 예 | 금지 | 검수 |
| 국내/국외·월 후보 점수 | 예 | 보조 제안 | 승인·수정 |
| 카드 카피 | 템플릿 | 초안 | 승인 |
| 리드타임 주수 | 예 | 문구 다듬기 | 승인 |
| 문의 유형 추천 | 휴리스틱 | 후보 확장 | 최종 |
| 메인 게시 | — | — | 예 |

---

## 9. 톤앤매너 가이드

> LLM 프롬프트에 싣는 발췌: `lib/bongtour-tone-manner-llm-ssot.ts` (원문·우선순위는 항상 본 섹션).

### 9.1 브랜드 톤 한 줄

**“제안하고, 설계하고, 상담으로 연결하는 여행 컨설팅 파트너.”**

### 9.2 사용 권장 문구

| 용도 | 예시 |
|------|------|
| 상담 권유 | “일정을 함께 맞춰 보시겠어요?”, “상담으로 가능 범위를 안내드립니다.” |
| 실행력 | “현지 기관 섭외·통역·이동을 **한 창구에서** 조율합니다.” |
| 시점 | “지금 상담을 시작하시면 준비 여유를 함께 검토하기 좋습니다.” |

### 9.3 사용 금지 문구

| 금지 | 이유 |
|------|------|
| 최저가·특가·마감임박·즉시결제 | 쇼핑몰 오인 |
| 공식 예약 사이트처럼 보이는 표현 | 공급사 관계 왜곡 |
| “무조건 가능” | 법·운영 리스크 |

### 9.4 CTA 문구 세트

| 용도 | 권장 CTA |
|------|----------|
| 상품 | 예약신청하기, 상담 신청하기 |
| 맞춤 | 맞춤 일정 문의하기 |
| 연수 | 연수·기관 방문 문의하기 |
| 버스 | 전세버스 견적 문의하기 |

### 9.5 오인 방지 문구 세트

- “봉투어는 **상담·접수 창구**이며, **최종 예약 조건은 공급사 확인 후** 안내드립니다.”
- “표시 가격·일정은 **참고용**이며, **실시간 변동**이 있을 수 있습니다.”

### 9.6~9.10 문체 규칙 (요약 표)

| 영역 | 규칙 |
|------|------|
| 메인 추천 카드 | 2인칭 최소, **사실·권장·이유** 중심, 감성 3:전문 7 |
| 예시 일정 브리핑 | **ItineraryDay 인용 구간**과 **봉투어 해석** 문단 분리 |
| 연수기관 섭외 | 조건부·단계형 (“검토 후”, “가능 시”) |
| 순차/동시통역 | 정의 → 적합 상황 → 봉투어 역할 |
| 버스 견적 | 운행 조건·변수 명시 |

### 9.5 공통 CTA·고지 레이어 (컴포넌트화 권장)

**왜 먼저 두는가:** 메인·상품 상세·문의 완료·푸터에서 **동일 문구가 어긋나면** 공급사 관계·결제 오인 이슈로 바로 이어진다. 한 컴포넌트(또는 CMS 키)로 묶어 **한 번 수정으로 전역 반영**한다.

| 블록 ID (예시) | 포함 문구·동작 |
|----------------|----------------|
| `CtaBookRequest` | 라벨: **예약신청하기** (`예약하기` 금지) |
| `DisclosureConsultHub` | “봉투어는 상담·접수 창구이며, 최종 조건은 **공급사 확인 후** 안내” |
| `DisclosureSupplierRelation` | “표시 상품은 **공급사 상품**을 기준으로 안내합니다” + 로고는 **보조(회색/텍스트 우선)** |
| `DisclosurePriceSchedule` | 가격·일정은 참고용·변동 가능 |
| `FooterLegalStrip` | 푸터 고지·문의 채널 |

**재사용 화면:** 메인 Hero/CTA, 상품 상세 하단, 4종 문의 폼 상단·하단, 제출 완료 페이지.

---

## 10. 주요 테이블/필드 초안 (요약)

| 테이블 | 역할 |
|--------|------|
| `CustomerInquiry` | 4종 문의 + `inquiry_type` + `status` + **스냅샷** + `lead_time_risk` |
| `product_curation_meta` | 상품별 큐레이션 추정 메타 |
| `monthly_curation_candidates` | 월별 후보 풀 |
| `monthly_curations` | 월·세그먼트 묶음 |
| `monthly_curation_items` | 메인 카드 (승인 게이트) |
| `lead_time_rule` | 권장 상담 시작 시점 규칙 (**주 단위 min/max** + peak 범위) |
| `inquiry_routing_meta` | 접수 시 **라우팅 근거** (스냅샷은 CustomerInquiry) |
| 기존 `Product` / `ProductDeparture` / `ItineraryDay` | 변경 없이 **입력 소스**로 유지 |

---

## 11. 실제 구현 순서 제안

| 단계 | 내용 |
|------|------|
| **1** | **공통 CTA·고지 레이어** 컴포넌트(§9.5) + 디자인 토큰·문구 키 확정 — 메인/상세/폼/완료에 **빈 슬롯만** 연결 |
| 2 | `CustomerInquiry` + API + 스냅샷 필드 저장 + `lead_time_risk` 계산 + 관리자 목록(최소) |
| 3 | 4폼 프론트 + `inquiry_type` 분기 + 상품 상세 CTA를 공통 레이어로 교체 |
| 4 | `lead_time_rule` 시드(**범위형 컬럼**) + 규칙 엔진 유틜 + 문구 템플릿 |
| 5 | `product_curation_meta` 배치(`interpretation_mode_hint`, `vehicle_class_hint` 포함) |
| 6 | `monthly_curation_*` 파이프라인 + `primary_inquiry_type`·`briefing_source_type` + 관리자 승인 UI |
| 7 | 메인 섹션 연동(게시분만, 출처 배지) |
| 8 | Gemini 연동은 **카피·힌트 초안만**, 프롬프트에 금지 목록 하드코딩 |
| 9 | 톤 가이드·스냅샷·위험도 정렬 QA |

---

## 12. 리스크 및 주의사항

| 리스크 | 완화 |
|--------|------|
| Gemini 환각 문구 | 게시 전 **관리자 승인** 필수, 금지 프롬프트 |
| 공급사 관계 오인 | 푸터·폼·상세 **고지 문구** 고정 모듈화 |
| 가격/일정 불일치 | 노출은 **ProductDeparture** SSOT, 메인 카드에 가격 강조 금지 |
| 법적 표현 | “직영”“섭외 가능” 등 **검수 체크리스트** |
| 성능 | 월별 후보 배치는 야간, 메인는 `is_published` 캐시 |
| 스냅샷 누락 | 제출 API에서 `snapshot_*` 미기록 시 CS 분쟁 시 재현 불가 → **서버에서 필수 검증**(상품/카드 경로별) |
| `lead_time_risk` 오판 | 희망일 미입력 다수 → 기본 `normal` + “정보 부족” 배지, 규칙 버전 로그 보관 |
| `briefing_source_type` 혼동 | `hybrid` 남용 시 고객 혼란 → 관리자 검수 시 **출처 배지** 필수 체크 |
| 통역·차량 힌트 오해 | 힌트를 “확정 서비스”로 오인 → 카드·폼에 **“상담 시 확정”** 문구를 공통 레이어와 연동 |

---

## 관련 문서

- [HANATOUR-VERIFICATION-LOG.md](./HANATOUR-VERIFICATION-LOG.md) (공급사 어댑터 실측 로그)
- 상품 3축: `prisma/schema.prisma` 주석 및 `Product` / `ProductDeparture` / `ItineraryDay` 모델
