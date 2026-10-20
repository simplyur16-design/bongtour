# 봉투어 상품 표면 v1 — 로컬 설계 계약

**상태:** `draft-local` · **L0+L1 진행중** — 디자인·카피·연동이 잠기기 전 **커밋·배포 금지**.  
**목적:** 인더월드형 톤(폰트·색·칩·이모지·동선지도·짧은 제목)을 봉투어 공개 상품 표면에 이식하기 위한 SSOT.  
**범위:** 해외 패키지·FIT 공개 상세·목록 카드. Simplyur eSIM·관리자 등록 UI는 별도.  
**브랜드 축:** Ocean Warm (`app/styles/bongtour-ocean-warm.tokens.css`) — product-surface 토큰은 동일 축 alias.  
**목업:** `/dev/product-surface-preview` (development only).

---

## 0. 잠긴 원칙

1. **복제 금지** — 인더월드 로고·카피·약관·사진을 베끼지 않는다. 패턴·토큰·정보구조만 가져온다.
2. **공급사 원문 보존** — `Product.originalTitle`(없으면 listing 원문)은 항상 보관. 공개 짧은 제목으로 덮어쓰지 않는다.
3. **공개 제목 3층** — (A) 히어로 짧은 제목 (B) 한 줄 보조 (C) 원문/마케팅 장제목은 상세·관리·SEO 보조.
4. **완벽 전 미배포** — 이 문서·토큰·SSOT만 로컬 반영. 프로덕션 라우트 import·Railway·git push 금지(운영자 승인 전).
5. **기존 R-5와 공존** — `bongtour-product-title-tone-ssot` / `marketing_compose`는 유지. v1 짧은 제목은 **새 모듈**이 담당한다.

---

## 1. 시각 토큰 (Design tokens)

파일: `app/styles/bongtour-product-surface.tokens.css`  
**아직 글로벌 CSS에 import 하지 않음.**

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--bt-ps-font` | Pretendard, system stack | 전 표면 |
| `--bt-ps-ink` | `#1A1A1A` | 제목 |
| `--bt-ps-muted` | `#64748B` | 메타·라벨 |
| `--bt-ps-brand` | `#2F8FC7` (= Ocean Warm) | 가격·활성·CTA 테두리 |
| `--bt-ps-brand-soft` | `#E8F4FC` | hover/보조 블루 |
| `--bt-ps-brand-deep` | `#0E7CC0` | 강조 |
| `--bt-ps-navy` | `#16223A` | FAB·강한 면 |
| `--bt-ps-sand-bg` | `#F7F1E3` | 상태 칩 배경 |
| `--bt-ps-sand-fg` | `#8A6D2F` | 상태 칩 글자 |
| `--bt-ps-benefit-bg` | `#EFF6FF` | 혜택 칩 배경 |
| `--bt-ps-benefit-fg` | `#1D4ED8` | 혜택 칩 글자 |
| `--bt-ps-section-gold` | `#B8860B` 계열 | USP `01` 번호 |
| `--bt-ps-surface` | `#FFFFFF` | 본문 |
| `--bt-ps-card` | `#F8FAFC` | 가격·요약 카드 |
| `--bt-ps-radius-card` | `16px` | 히어로·카드 |
| `--bt-ps-radius-chip` | `8px` / pill `999px` | 칩 |
| `--bt-ps-sticky-h` | `64px`~`72px` | 하단 CTA |

### 타이포 스케일

| 역할 | size / weight | letter-spacing |
|------|---------------|----------------|
| 히어로 짧은 제목 | 22–24px / 800 | −0.02em |
| 가격 메인 | 20–22px / 700–800 | 0 | brand 색 |
| 본문 | 14px / 400 | 0 |
| 칩 | 12–12.5px / 600–700 | 0 |
| USP 번호 | 18–20px / 700 | 0 | section-gold |

### 금지

- Inter/Roboto/Arial를 브랜드 폰트로 쓰지 않음(폴백만).
- 보라·네온·다층 글로우·히어로 위 floating badge 남발.
- 이모지를 장식 배경으로 뿌리지 않음.

---

## 2. 칩·배지 규칙

| 종류 | 스타일 | 예시 |
|------|--------|------|
| 상태/성격 | sand bg + sand fg + 작은 불릿 | 모집중, 소규모, 가족여행, 프라이빗 |
| 혜택 | benefit soft blue pill | 노쇼핑, 노팁, 노옵션, 미식 |
| 기간 강조 | brand soft (선택 1개만) | 8박10일 |
| 메타 행 | muted 텍스트, 칩 아님 | 상품코드, 출발지 |

한 줄 최대 권장: 상태 3 + 혜택 4. 넘치면 `더보기`.

---

## 3. 아이콘 SSOT (문자 이모지 금지)

일정·숙소·식사 행 앞에는 **Lucide(또는 동일 stroke SVG)** 만 쓴다. `📍🏨🍽` 문자 이모지 금지.

| 역할 | 아이콘 | 비고 |
|------|--------|------|
| 일정 동선 | `MapPin` | route 행 prefix (아이콘 웰) |
| 숙소 | `Building2` | 예정호텔 카드 (아이콘 웰) |
| 식사 | `UtensilsCrossed` | 식사 카드 (아이콘 웰) |
| 직항·국내선·국제선·노쇼핑… | `BongtourBenefitIcon` | pastel squircle — `refs/benefit-icons-row.jpg` |
| 포함/불포함 | 텍스트 또는 stroke check/x | 이모지 ✓✕ 지양 |
| 지도 | Gemini 그림 (터키맵 baseline보다 고급) | Imagen route_map · `refs/route-map-turkiye-baseline.jpg` |

일정 `routeText` 본문에 아이콘/이모지를 삽입하지 않는다. **렌더러가 행 앞에만** 붙인다.

---

## 4. 정보 구조 (상품 상세)

### 4.1 스크롤 골격

**모바일**

1. 히어로 갤러리 (라운드 + 썸네일) — **스크롤과 함께 위로 사라짐** (히어로 `position: sticky` 금지)  
2. 짧은 제목 + 보조 + 상품코드  
3. 칩 행  
4. 가격·출발 요약 → 출발일·요금 펼침  
5. **탭:** 상품정보 | 일정 | 동선지도 | 유의사항  
6. 하단 sticky **바**(모바일만): 가격 + 상담 + 예약. 스크롤 끝 **사이트 푸터**.  

**PC (홈과 같은 편집형 폭 — 휴대폰 폭 중앙 정렬 금지)**

- 상단: 좌 갤러리(고정 폭) · 우 제목·칩·가격 요약 — **갤러리 sticky 하지 않음**. 본문 내리면 사진도 같이 스크롤 아웃.  
- 그 아래 탭·일정은 **페이지 full measure** (약 960–1100px 콘텐트).  
- **모바일식 하단 삼분할·예약 sticky 바는 PC에 두지 않음.** 우측/본문 견적·CTA + **푸터**.  
- 사진이 글을 따라다니며 가리는 동작 금지.

### 4.2 상품정보 탭

- 📢 예약 전 고지 (불릿 3–5, 법적 고지 기존 SSOT 재사용)  
- USP `01`…`0n` (골드 번호 + 제목 + 1–2문장) — `counselingNotes` / highlight 파생  
- ✓ 포함 / ✕ 불포함 — `includedText` / `excludedText` 파서 렌더  
- 기존 MustKnow·옵션·쇼핑 블록은 하위 접기  

### 4.3 일정 탭

- 일차 카드: 제목 + Lucide `MapPin` route 요약 + `Building2`/`UtensilsCrossed` 호텔·식사 카드  
- 문자 이모지(`📍🏨🍽`) 금지 — stroke SVG만  
- **description 원문 길이·줄바꿈 유지** (화면에서 짧게 잘라내지 않음)

### 4.4 동선지도 탭 (신규 표면)

**목표가 아닌 것:** 무료 OSM/Leaflet 타일맵, Google/Kakao 턴바이턴 내비.  
**목표:** **Gemini가 그린** 동선지도 이미지 + 구간 **교통수단** 범례.

- **A:** `buildBongtourRouteMapChain` → 도시 순서  
- **T:** `inferBongtourRouteMapTransport` → 항공·차량·버스 등 mode  
- **B:** Gemini JSON은 mode 보강만 (도시 발명/삭제 거부)  
- **I:** Gemini/Imagen이 지도 그림 (`generateBongtourRouteMapImage`)  
- **C:** 이미지 + `routeSummary` + 교통 범례 (`docs/design/bongtour-route-map-gemini-v1.md`)  
- 도시 0–1개면 탭 숨김.

모듈: `lib/bongtour-route-map-chain-ssot.ts` · `transport` · `gemini-*` · `bongtour-route-map-image.ts`

---

## 5. 제목 3층 계약

### 5.1 필드 매핑 (현행 스키마 기준, 마이그레이션 없이)

| 층 | 이름 | 출처 | 공개 |
|----|------|------|------|
| A | `heroShortTitle` | `composeBongtourHeroShortTitle(...)` 결정론 | 카드·히어로 H1 |
| B | `heroSubtitle` | 도시 1–2 또는 테마 1토큰 | 카드 서브·히어로 아래 |
| C | `originalTitle` / `title` | DB 보관·SEO·관리 | 상세 “공급사 상품명” 접기·admin |

`Product.title` 저장 정책은 **당장 변경하지 않는다.**  
공개 UI가 v1을 켤 때만 A/B를 렌더하고, C는 접기/메타.

### 5.2 `heroShortTitle` 규칙

형식: `{대표장소} {일수토큰}`

**대표장소 우선순위**

1. 단일 국가 상품 + 대표 도시가 브랜드급(다낭, 푸켓, 세부…) → **도시**  
2. 단일 국가 → **국가 한글 라벨** (`Country.koreanLabel` / destination 정규화)  
3. 다국가·일주·권역 → **권역** (동유럽, 북유럽…)  
4. 실패 시 destinationRaw 짧은 토큰 → 최후 `여행`

**일수토큰**

1. `duration`의 `N박 M일` → 공개는 **`M일`** (인더월드형) 또는 상세에 `N박M일` 병기  
2. 없으면 원제목/`getProductTotalDays`  
3. 일수 없으면 short title 실패 → UI는 기존 `title` 폴백  

**테마 예외 (1토큰만)**  
`아이슬란드 오로라 7일` — 나라+테마+일수. 테마 화이트리스트: 오로라, 성지순례, 크루즈, 골프, 트레킹 등(모듈 상수).

### 5.3 `heroSubtitle` 규칙

- short가 **국가**이면: 도시 1–2 (`·` 연결)  
- short가 **도시**이면: 국가 또는 두 번째 도시 / 비우기  
- short가 **권역**이면: 대표국 1–2  
- 없으면 null  

### 5.4 모듈

- `lib/bongtour-product-display-title-ssot.ts`  
- 테스트: `lib/bongtour-product-display-title-ssot.test.ts`  
- **생성기는 confirm 저장 경로에 연결하지 않음** (로컬 계약만).

### 5.5 SEO

- `<title>`: 당분간 기존 `product-public-seo-title` 유지.  
- v1 공개 시: `heroShortTitle | 봉투어` 검토. 원문 장제목을 title 태그 전체에 쓰지 않음.

---

## 6. USP·포함 블록 카피 톤

- **무조건 길게 쓰지 않는다.** 알짜(동선·포함·제외·조건)가 없으면 문단을 만들지 않는다.  
- 형용사(“프리미엄·엄선”) 남발 금지 — 기존 `BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS`와 정합.  
- USP는 **구체 동선·포함 범위** — 한 항목당 사실 중심으로 짧게.  
- 공급사 원문 highlight가 있으면 정제 후 번호만 부여. 없으면 생성하지 않고 섹션 숨김.  
- 홈 계획서 `bongtour-home-rebrand-plan-v1.md` §5(설명 품질)와 동일 원칙.

---

## 7. sticky CTA

| 요소 | 동작 |
|------|------|
| 좌 가격 | 선택 출발일 성인 1인, brand 색 |
| 상담 | 기존 상담/문의 모달 |
| 예약 | 기존 예약 인테이크 |

히어로 위 floating 프로모 스티커 금지.

---

## 8. 구현 단계 (승인 후)

| Phase | 내용 | 배포 |
|-------|------|------|
| L0 | 본 문서 + tokens.css + display/route SSOT + 테스트 | ❌ 로컬만 |
| L1 | 스토리북 또는 `/dev/product-surface-preview` (prod 라우트 가드) | ❌ |
| L2 | 모바일 상세 1곳에 feature flag | 운영자 승인 후 |
| L3 | 카드 목록 heroShortTitle | 승인 후 |
| L4 | 동선지도 SVG | 승인 후 |
| L5 | Pretendard/토큰 전역 적용 | 승인 후 |

L0 완료 조건: 테스트 green, 문서 리뷰, **커밋하지 않은 워킹트리**.

---

## 9. 수용 기준 (완벽의 정의)

디자인·내용이 “완벽”에 가깝다고 보려면 최소:

- [ ] 토큰으로 모바일·PC 목업 각 1장 (히어로+탭+sticky)  
- [ ] 제목 A/B 샘플 30건(공급사 혼합) 사람이 읽고 OK  
- [ ] 동선 체인 샘플 20건(단일국·다국·도시브랜드)  
- [ ] 기존 상세 회귀(가격·출발일·일정) 플래그 OFF 시 픽셀/동작 동일  
- [ ] 운영자 Explicit “커밋·배포 허용”

---

## 10. 관련 코드 앵커

| 자산 | 역할 |
|------|------|
| `lib/bongtour-product-title-tone-ssot.ts` | R-5 마케팅 장제목 톤(유지) |
| `lib/bongtour-product-title-marketing-compose.ts` | 장제목 폴백(유지) |
| `lib/bongtour-product-display-title-ssot.ts` | **v1 짧은 제목(신규)** |
| `lib/bongtour-route-map-chain-ssot.ts` | **동선 체인(신규)** |
| `app/styles/bongtour-product-surface.tokens.css` | 토큰(미연결) |
| `app/components/travel/TravelProductDetail.tsx` | 향후 플래그 연동점 |
| `app/components/travel/MobileProductDetail.tsx` | 향후 플래그 연동점 |

---

## 11. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-10-14 | L0 초안 — 로컬만, 커밋·배포 금지 |
| 2026-10-15 | L0 토큰·display/route SSOT·테스트 · L1 `/dev/product-surface-preview` · brand=Ocean Warm |
