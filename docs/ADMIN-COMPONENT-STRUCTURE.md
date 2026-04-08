# 봉투어 관리자 — 페이지/컴포넌트 구조

**기준**: docs/ADMIN-WIREFRAMES.md, docs/ADMIN-IA-IMPLEMENTATION.md  
**대상**: /admin, /admin/register, /admin/pending, /admin/products, /admin/bookings, /admin/scheduler-settings

---

## 1. 페이지별 필요한 컴포넌트 목록

### 1.1 대시보드 (`/admin`)

| 컴포넌트 | 책임 | 비고 |
|----------|------|------|
| **AdminDashboardPage** (page.tsx) | 레이아웃·데이터 fetch·섹션 배치 | 서버. KPI 건수 조회. |
| **AdminDashboardKpiCards** | 등록대기/상품목록/상담접수/오늘수집 카드 4개, 클릭 시 해당 경로 이동 | 클라이언트 또는 서버(Link만). |
| **AdminDashboardQuickActions** | [상품 등록][등록대기][상품 목록][상담·예약][브랜드 관리] 버튼 그룹 | 서버(Link)로 충분. |
| **AdminDashboardEmptyHint** | "등록대기 0건, 상품 0건. 상품 등록에서~" 블록 | 서버. 조건부 렌더. |
| **AdminDashboardControl** | 오늘 수집 현황·봇 상태·차트·run once·로그 터미널 | 클라이언트. (기존 존재) |

### 1.2 상품 등록 (`/admin/register`)

| 컴포넌트 | 책임 | 비고 |
|----------|------|------|
| **AdminRegisterPage** (page.tsx) | 전체 레이아웃·상태·submit 핸들러 | 클라이언트. (기존) |
| **AdminRegisterHeader** | H1 "상품 등록" + 서브 문구 | 페이지 내 인라인 또는 분리. |
| **AdminRegisterBrandSelect** | 여행사 드롭다운, GET /api/admin/brands, selectedBrandKey state | 클라이언트. 페이지에 흡수 가능. |
| **AdminRegisterUrlInput** | URL 입력 필드 + "URL에서 가져오기 (준비 중)" placeholder | 클라이언트. MVP에서는 비활성/숨김 가능. |
| **AdminRegisterTextarea** | 텍스트/HTML 붙여넣기 textarea | 페이지 내 인라인. |
| **AdminRegisterSubmitButton** | "AI 분석 및 상품 등록", loading 상태 | 페이지 내 인라인. |
| **AdminRegisterStatusBlock** | 상태 라벨 + 진행/성공/에러 메시지 | 페이지 내 인라인 또는 AdminRegisterStatus. |
| **AdminRegisterSuccessActions** | 저장 성공 시 [등록대기로 이동][상품 상세 보기] + 하단 링크 | 클라이언트. |
| **AdminRegisterFirstClassification** | 1차 자동 분류 표시(국가·도시·여행타입·쇼핑·가이드경비·선택관광). 읽기 전용. | 클라이언트. API가 parsed 반환 시 표시. MVP에서는 생략 가능. |

### 1.3 등록대기 (`/admin/pending`)

| 컴포넌트 | 책임 | 비고 |
|----------|------|------|
| **AdminPendingPage** (page.tsx) | fetch 목록·상태·승인 핸들러·레이아웃 | 클라이언트. (기존) |
| **AdminPendingHeader** | H1 + 서브 문구 | 인라인 또는 AdminPageHeader 공통. |
| **AdminPendingKpiCard** | "등록대기 N건" 카드 | 인라인 또는 AdminKpiCard 공통. |
| **AdminPendingTable** | 테이블: 여행사, 코드, 상품명, 목적지, 이미지, 1차분류, 2차분류, 상태, 액션 | 클라이언트. |
| **AdminPendingRow** | 행 + 확장 영역(이미지 소스, 2차 분류, 승인/반려/보류) | 클라이언트. |
| **AdminPendingImageActions** | [Pexels 검색][Gemini 생성][수동 업로드] | 클라이언트. MVP에서는 "이미지 수급" 링크만 가능. |
| **AdminPendingClassificationForm** | 2차 분류: 대표 지역, 테마 태그, 노출 카테고리, 타깃 고객 | 클라이언트. 후속 확장. |
| **AdminPendingApproveActions** | [승인(상품목록으로)][반려][보류] | 클라이언트. |

### 1.4 상품 목록 (`/admin/products`)

| 컴포넌트 | 책임 | 비고 |
|----------|------|------|
| **AdminProductsPage** (page.tsx) | fetch 목록/옵션·필터·페이징·액션 핸들러 | 클라이언트. (기존) |
| **AdminProductsHeader** | H1 + 서브 문구 | 인라인 또는 공통. |
| **AdminProductsKpiCards** | 총 N건, 노출 중 M건 (선택) | 인라인 또는 AdminKpiCard. |
| **AdminProductsFilters** | 검색 입력 + 브랜드/국가/도시/노출 필터 | 클라이언트. |
| **AdminProductsTable** | 체크박스, 여행사, 코드, 상품명, 목적지, 기간, 노출 토글, 수정일, 액션 | 클라이언트. |
| **AdminProductsRow** | 행 + [상세][가격 동기화][노출 토글] 등 | 클라이언트. |
| **AdminProductsPagination** | 이전 / 1 2 3 / 다음 | 클라이언트. (기존에 있을 수 있음) |
| **AdminProductsBulkActions** | 선택 N건 [가격 동기화 일괄] (선택) | 클라이언트. 후속. |

### 1.5 상담·예약 (`/admin/bookings`)

| 컴포넌트 | 책임 | 비고 |
|----------|------|------|
| **AdminBookingsPage** (page.tsx) | fetch 목록·상세·상태 변경·레이아웃 | 클라이언트. (기존) |
| **AdminBookingsHeader** | H1 "상담·예약" + 서브 문구 | 인라인 또는 공통. |
| **AdminBookingsKpiCards** | 접수 N건, 상담중 M건, 확정 P건 (선택) | 인라인 또는 AdminKpiCard. |
| **AdminBookingsList** | 접수 목록 테이블/카드, 행 클릭 시 상세 | 클라이언트. |
| **AdminBookingsDetailPanel** | 고객명·연락처·관심상품·문의·참고 금액·상담 메모·상태 변경 버튼 | 클라이언트. (기존 상세 블록) |
| **AdminBookingsStatusButtons** | 접수완료/상담중/예약확정/취소 | 클라이언트. |

### 1.6 스케줄러·보안 (`/admin/scheduler-settings`)

| 컴포넌트 | 책임 | 비고 |
|----------|------|------|
| **AdminSchedulerSettingsPage** (page.tsx) | fetch config·저장·run once·비상정지·레이아웃 | 클라이언트. (기존) |
| **AdminSchedulerHeader** | H1 + 서브 문구 | 인라인. |
| **AdminSchedulerForm** | Cron 시/분, restMin/restMax, headless, UA random, mouse movement | 클라이언트. |
| **AdminSchedulerActions** | [설정 저장][지금 1회 실행][비상 정지] | 클라이언트. |
| **AdminSchedulerLog** | 최근 로그 N줄 또는 "대시보드에서 확인" 링크 (선택) | 클라이언트. 후속. |

---

## 2. 각 컴포넌트의 책임 (요약)

- **페이지(page.tsx)**: URL·라우트·데이터 로드(서버 시 fetch)·상태·핸들러·섹션 배치.  
- **헤더/서브**: 제목 + 한 줄 설명. 재사용 시 `AdminPageHeader`.  
- **KPI 카드**: 라벨 + 숫자(또는 문구), 필요 시 Link.  
- **빠른 액션**: Link 버튼 그룹.  
- **테이블/리스트**: 데이터 표시 + 행별 액션.  
- **폼/입력**: 입력 필드 + 제출 버튼 + 검증.  
- **상태/성공/에러 메시지**: 인라인 또는 작은 블록 컴포넌트.

---

## 3. 서버 컴포넌트 / 클라이언트 컴포넌트 구분

| 페이지/블록 | 서버 | 클라이언트 | 이유 |
|-------------|------|------------|------|
| **대시보드** | page.tsx(건수 조회), KPI 카드·빠른 액션(Link만) | AdminDashboardControl, (선택) KPI 카드가 링크만이면 서버 가능 | 건수는 Prisma 서버에서. 로그·run once·차트는 클라이언트. |
| **상품 등록** | — | page 전체 | 폼·onChange·submit·로딩 상태. |
| **등록대기** | — | page 전체 | 목록 fetch·승인·행 확장·이미지 액션. |
| **상품 목록** | — | page 전체 | 필터·페이징·토글·동기화 버튼. |
| **상담·예약** | — | page 전체 | 목록·상세·상태 변경. |
| **스케줄러·보안** | — | page 전체 | 설정 폼·저장·run once·비상정지. |
| **레이아웃** | layout.tsx | AdminSidebar | 레이아웃은 서버, 사이드바는 클라이언트(경로 활성). |

**원칙**:  
- 데이터만 가져와서 정적으로 보여주는 블록은 서버 가능(예: 대시보드 KPI 숫자+Link).  
- 사용자 입력·onClick·fetch 후 setState·모달·탭·폼은 클라이언트.

---

## 4. 공통 컴포넌트 후보

| 컴포넌트 | 용도 | 사용 페이지 |
|----------|------|-------------|
| **AdminPageHeader** | H1 + 서브 문구. props: title, subtitle. | 모든 6개 페이지. |
| **AdminKpiCard** | 라벨 + 숫자(또는 children). optional href. | 대시보드, 등록대기, 상품목록, 상담·예약. |
| **AdminQuickActionLink** | 1차/2차 스타일 Link 버튼. | 대시보드. |
| **AdminEmptyState** | 아이콘(선택) + 메시지 + 다음 행동 안내. | 등록대기, 상품목록, 상담·예약. |
| **AdminErrorBlock** | 에러 메시지. 빨간 톤. | 전역. |
| **AdminSuccessBlock** | 성공 메시지. 녹색 톤. | 상품 등록, 등록대기, 상품목록, 상담·예약, 스케줄러. |
| **AdminTable** | thead + tbody, 공통 스타일. children으로 tr. | 등록대기, 상품목록, 상담·예약. |
| **AdminPagination** | 이전/페이지 번호/다음. | 상품목록. |

---

## 5. 상태 배지 / 테이블 / 액션 버튼 공통화 후보

### 5.1 상태 배지

| 컴포넌트 | 용도 | props 예시 |
|----------|------|------------|
| **AdminStatusBadge** | 단일 상태 칩. 톤별 스타일. | `variant: 'pending' \| 'registered' \| 'hidden' \| 'error' \| '접수완료' \| '상담중' \| '예약확정' \| '취소' \| '노출' \| '비노출'`, `label?: string` |

- **사용처**: 등록대기(이미지준비/미준비, 검수대기, 보류, 반려), 상품목록(노출/비노출, 에러), 상담·예약(접수완료/상담중/예약확정/취소).
- **위치**: `app/admin/components/AdminStatusBadge.tsx` (신규).

### 5.2 테이블

| 컴포넌트 | 용도 | props 예시 |
|----------|------|------------|
| **AdminTable** | 공통 wrapper. table + thead + tbody. | `children`, `className?` |
| **AdminTableRow** | tr + 호버. 클릭 시 onSelect(선택). | `children`, `onClick?` |

- **사용처**: 등록대기 테이블, 상품목록 테이블, 상담·예약 목록(테이블 또는 카드).
- **위치**: `app/admin/components/AdminTable.tsx` (신규, 선택). 기존 테이블을 그대로 써도 됨.

### 5.3 액션 버튼

| 컴포넌트 | 용도 | props 예시 |
|----------|------|------------|
| **AdminButton** | 1차(채움)/2차(테두리)/danger. | `variant: 'primary' \| 'secondary' \| 'danger'`, `href?`, `children`, `disabled?` |
| **AdminActionGroup** | 버튼 여러 개 가로 배치. | `children` |

- **사용처**: 모든 페이지의 주요 버튼. 링크인 경우 Next Link + 동일 스타일.
- **위치**: `app/admin/components/AdminButton.tsx` (신규, 선택). 기존 tailwind 클래스로도 가능.

---

## 6. 먼저 구현할 페이지 순서

1. **대시보드** — 이미 구현됨. KPI 카드·빠른 액션·AdminDashboardControl 유지. 필요 시 AdminPageHeader·AdminKpiCard로 교체.
2. **상품 등록** — 이미 단일 입구로 정리됨. 1차 분류 표시·URL placeholder 추가가 후속.
3. **등록대기** — 테이블·승인 유지. 이미지 소스 선택(Pexels/Gemini/업로드)·2차 분류 확정은 후속.
4. **상품 목록** — 검색/필터·노출 토글·가격 동기화 유지. 노출 컬럼·대량 액션은 후속.
5. **상담·예약** — 목록·상세·상태 변경 유지. KPI 카드·상담 메모·오픈채팅(개념)은 후속.
6. **스케줄러·보안** — 기존 폼·저장·run once·비상정지 유지. 로그 영역은 선택.

---

## 7. 실제 수정 대상 파일 후보

| 우선순위 | 파일 | 조치 |
|----------|------|------|
| 1 | `app/admin/page.tsx` | 유지. 필요 시 AdminPageHeader·AdminKpiCard 분리. |
| 2 | `app/admin/register/page.tsx` | 1차 분류 표시 블록 추가(API가 parsed 반환 시). URL placeholder 영역 추가(비활성). |
| 3 | `app/admin/pending/page.tsx` | 테이블 컬럼 정리(이미지, 1차분류). 승인/반려 유지. 이미지 소스·2차 분류는 후속. |
| 4 | `app/admin/products/page.tsx` | 노출 컬럼/토글 추가(필드·API 연동). 필터에 노출 추가. |
| 5 | `app/admin/bookings/page.tsx` | 유지. KPI 카드(접수/상담중/확정) 추가는 후속. |
| 6 | `app/admin/scheduler-settings/page.tsx` | 유지. |
| 7 | `app/admin/components/AdminPageHeader.tsx` | **신규**. title, subtitle. |
| 8 | `app/admin/components/AdminKpiCard.tsx` | **신규**. label, value, href(선택). |
| 9 | `app/admin/components/AdminStatusBadge.tsx` | **신규**. variant, label. |
| 10 | `app/admin/components/AdminEmptyState.tsx` | **신규**. message, actionLabel, actionHref(선택). |

- **AdminTable / AdminButton**: 공통화가 필요해지면 신규 생성. 당장은 기존 마크업 유지해도 됨.

---

## 8. 페이지별 최소 구현 버전(MVP)과 후속 확장 포인트

### 8.1 대시보드

- **MVP**: KPI 카드 4개(등록대기·상품목록·상담접수·오늘 수집), 빠른 액션 5개, 빈 상태 안내, AdminDashboardControl(오늘 수집·봇·run once·로그).
- **후속**: AdminPageHeader·AdminKpiCard 컴포넌트로 교체. 카드 클릭 시 쿼리 파라미터 등 추가.

### 8.2 상품 등록

- **MVP**: 여행사 선택, 텍스트/HTML textarea, [AI 분석 및 상품 등록], 상태 메시지, 저장 성공 시 [등록대기로 이동][상품 상세 보기], 하단 링크.
- **후속**: URL 입력 영역(비활성 → 활성). 1차 자동 분류 표시(국가·도시·여행타입·쇼핑·가이드경비·선택관광). parse-and-register가 parsed 반환 시 해당 블록 렌더.

### 8.3 등록대기

- **MVP**: 등록대기 N건 카드, pending 목록 테이블(여행사·코드·상품명·목적지·이미지 준비·업데이트일), 행별 [상세][승인(등록)]. 빈 상태·에러·성공 메시지.
- **후속**: 이미지 소스 선택(Pexels/Gemini/수동 업로드). 2차 분류 확정 폼(대표 지역·테마·노출 카테고리·타깃 고객). 반려/보류. ProcessRecentImagesButton 배치.

### 8.4 상품 목록

- **MVP**: 검색·필터(항공사·목적지·에러), 테이블(여행사·코드·상품명·목적지·기간·수정일), 행별 [상세 수정][가격 동기화]. 페이징. 빈/에러/성공 메시지.
- **후속**: 노출 on/off 컬럼·토글(필드·API). "노출 중 M건" KPI. 이미지 재처리 버튼. 선택 N건 가격 동기화 일괄.

### 8.5 상담·예약

- **MVP**: 헤더 "상담·예약" + 서브 문구. 접수 목록(접수일·상품명·출발일·인원·고객명·연락처·상태). 행 클릭 시 상세 패널(고객·연락처·관심 상품·참고 금액·상태 변경 버튼). 빈/에러/성공 메시지.
- **후속**: KPI 카드(접수 N건·상담중·확정). 상담 메모 입력·저장. 오픈채팅 연결 링크 또는 메모(개념).

### 8.6 스케줄러·보안

- **MVP**: H1 + 서브 문구. Cron 시/분, restMin/restMax, headless·UA random·mouse movement 체크, [설정 저장][지금 1회 실행][비상 정지]. 저장/실행/비상정지 성공·에러 메시지.
- **후속**: 마지막 실행 시각·성공/실패·대기 큐 카드. 최근 로그 N줄 또는 "대시보드에서 확인" 링크.

---

*이 문서는 와이어프레임을 실제 페이지/컴포넌트 구조로 나눈 기준으로, 구현 시 참고용으로 사용할 수 있습니다.*
