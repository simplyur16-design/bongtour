# 봉투어 전역 컬러 토큰 (SSOT)

로고 골드·블루는 **브랜드 액센트**로만 쓰고, 본문·제목은 **네이비·슬레이트 계열 (`--bt-text-*`)**로 가독성을 유지합니다.

## Cursor / 구현자용 금지 규칙

- **페이지·컴포넌트에 임의 팔레트 추가 금지** (`text-slate-*`, `text-teal-*`, `text-blue-*`, `text-yellow-*`, `bg-gray-*` 등 Tailwind 기본 색으로 새 UI를 꾸미지 않는다).
- 필요한 색이 없으면 **기존 `--bt-*` 조합**으로 해결하거나, 제품 책임자와 합의 후 `globals.css`에만 변수를 추가한다.
- **원화 상품 가격**은 반드시 `text-bt-price` (teal). 골드·노랑으로 가격을 강조하지 않는다.

## 텍스트 역할 (`strong` / `body` / `muted` / `meta` / `subtle`)

| 역할 | CSS 변수 | Tailwind 예시 | 용도 |
|------|-----------|----------------|------|
| 최강 제목·강조 제목 | `--bt-text-strong` | `text-bt-strong` | 히어로급 제목, 일정표 대제목 |
| 상품명·섹션 제목 | `--bt-text-title` | `text-bt-title` | 카드 제목, 패널 헤더 |
| 본문 | `--bt-text-body` | `text-bt-body` | 설명, 리스트 본문 |
| 보조·캡션 | `--bt-text-muted` | `text-bt-muted` | 부가 설명, 비활성에 가까운 라벨 |
| 메타·날짜·출처 | `--bt-text-meta` | `text-bt-meta` | 부가 메타, 빈 상태 안내 |
| 힌트·구분선 라벨 | `--bt-text-subtle` | `text-bt-subtle` | placeholder 성격, 덜 중요한 보조 |

## 링크·active·selection (블루 우선)

| 역할 | 변수 / 클래스 | 용도 |
|------|----------------|------|
| 링크 | `--bt-link`, `text-bt-link`, `hover:text-bt-link-hover` | 인라인 링크, 목록 복귀 링크 |
| 강한 포인트 | `--bt-brand-blue-strong`, `text-bt-brand-blue-strong` | 탭 active 텍스트·밑줄, 선택 강조 |
| 소프트 배경 | `--bt-brand-blue-soft`, `bg-bt-brand-blue-soft` | 탭·칩 선택 배경, 정보 박스 |
| 레거시 액센트 | `--bt-accent`, `text-bt-accent`, `bg-bt-accent-subtle` | 기존 컴포넌트와의 호환 |

**블루 사용 우선순위:** 링크 → 탭/필터 **active** → 선택/포커스 테두리. 메인 CTA는 아래 CTA 토큰(블루 기반 primary)을 쓴다. active 탭이 메인 CTA와 동일한 채도로 보이면 `border`만 강하게, 배경은 `blue-soft`로 차등한다.

## 가격·비활성·경고·위험

| 역할 | 변수 | Tailwind | 용도 |
|------|------|----------|------|
| 원화 가격 | `--bt-price` | `text-bt-price` | 패키지 견적, 달력 요금 |
| 달력 가용/일차 라벨 | `--bt-calendar-available` | `text-bt-cal-available` | (teal 계열) 일정 DAY 라벨 등 **가격과 구분되는** 여행 UI 강조 |
| 비활성·미운영 | `--bt-disabled` | `text-bt-disabled`, `border-bt-cal-unavailable` | 출발 없음, 비활성 날짜 |
| 경고·외화 별도 비용 강조 | `--bt-warning` | `text-bt-warning` | 현지 지불·선택관광 USD 등 (원화 `price`와 구분) |
| 위험·오류 | `--bt-danger` | `text-bt-danger` | 폼 오류, 반려·오류 배지 텍스트 |
| 성공 | `--bt-success` | `text-bt-success`, 보더에 병행 | 성공 메시지, 녹색 보더 |

## 골드 (`--bt-brand-gold`) 허용 범위

- **허용:** 소규모 액센트 CTA, 최저가 보조 하이라이트(`--bt-calendar-lowest`), 키워드 칩 등 **얇은** 테두리/배지.
- **금지:** 본문·긴 제목·기본 가격 색, 섹션 전체 배경 도배.

## CTA 버튼

| 유형 | 클래스 |
|------|--------|
| 메인 | `bg-bt-cta-primary text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover` |
| 보조 | `bg-bt-cta-secondary border border-bt-cta-secondary-border text-bt-cta-secondary-text` |
| 액센트 (제한) | `bg-bt-cta-accent text-bt-cta-accent-text` |

모든 주요 버튼을 노랑/골드로 통일하지 않는다. 기본 CTA는 브랜드 블루 primary.

## 배지 (`bt-badge-*`)

- 유형·정보: `bg-bt-badge-package` + `text-bt-badge-package-text`, `bg-bt-badge-freeform` + `text-bt-badge-freeform-text`, `bg-bt-badge-domestic` + `text-bt-badge-domestic-text`.
- 공급사 라벨: `text-bt-supplier` (tailwind: `text-bt-supplier` → `supplier` 키).
- 관리자 상태: `AdminStatusBadge`는 위 토큰 조합만 사용 (사용자용 카드 배지와 동일 문법 남용 금지 — **절제된** `surface-alt` / `danger` 조합).

## 표면·경계

- `bg-bt-surface`, `bg-bt-surface-soft`, `bg-bt-page`
- `border-bt-border`, `border-bt-border-soft`, `border-bt-border-strong`

## 로고 노출 정책 (헤더 + 히어로)

- **헤더:** `public/images/bongtour-logo.webp` — 브랜드 식별의 기본 위치.
- **메인 히어로 (`MainHero`):** 로고 이미지 **미사용**. 카피·메시지 중심으로 두어 헤더와 중복되지 않게 한다.

## Tailwind (`tailwind.config.ts`)

`text-bt-*`, `bg-bt-*`, `border-bt-*` 형태로 `theme.extend.colors.bt`에 매핑되어 있다. 자주 쓰는 것:

- `text-bt-strong`, `text-bt-title`, `text-bt-body`, `text-bt-muted`, `text-bt-meta`, `text-bt-subtle`
- `text-bt-link`, `text-bt-price`, `text-bt-disabled`, `text-bt-danger`, `text-bt-warning`
- `bg-bt-cta-primary`, `bg-bt-brand-blue-soft`, `bg-bt-surface-soft`
- `border-bt-border-soft`, `border-bt-brand-blue-strong`

## 관리자 UI

- 셸: `bg-bt-surface-soft`, 본문 `text-bt-body`, 제목 `text-bt-title`.
- 사이드바: 어두운 배경은 `bg-bt-title` 등 기존 패턴 유지, 활성 행은 `bg-bt-brand-blue-soft text-bt-title`.
- 골드 액센트는 관리자에서 **거의 사용하지 않는다**.

## CSS 소스

- 변수 정의: `app/globals.css` `:root`
- 상세 문구·타이포 위계: `docs/DESIGN-TOKENS-TEXT.md`
