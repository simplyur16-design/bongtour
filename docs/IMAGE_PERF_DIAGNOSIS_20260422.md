# 이미지 로딩 성능 진단

작성일: 2026-04-22  
범위: 저장소 정적 분석(grep·파일 열람). **코드 변경 없음.**  
참고: 메인 노출 URL은 `public/data/home-hub-active.json`, `public/data/home-hub-candidates.json`, `lib/image-fallback.ts` 등 **저장소에 커밋된 값**에서 인용함.

---

## 1. 현재 이미지 서빙 방식

### 1-1. `next/image` 사용 여부

`from 'next/image'` 또는 `from "next/image"` 매칭 파일(15개):

| # | 경로 |
|---|------|
| 1 | `app/components/home/HomeMobileHub.tsx` |
| 2 | `app/components/travel/overseas/OverseasCompareCard.tsx` |
| 3 | `app/components/charter-bus/CharterBusLanding.tsx` |
| 4 | `app/components/SiteFooter.tsx` |
| 5 | `app/components/home/HomeHubFourClientCard.tsx` |
| 6 | `app/components/home/HomeMobileHubSeasonCarousel.tsx` |
| 7 | `app/components/Header.tsx` |
| 8 | `app/components/travel/overseas/OverseasManagedContent.tsx` |
| 9 | `components/products/OverseasMonthlyCurationMid.tsx` |
| 10 | `components/admin/home-hub/HomeHubImageCandidateGrid.tsx` |
| 11 | `components/admin/home-hub/HomeHubHybridCardOperationsPanel.tsx` |
| 12 | `app/components/training/TrainingHub.tsx` |
| 13 | `app/components/SafeImage.tsx` |
| 14 | `app/components/common/RepresentativeNameImage.tsx` |
| 15 | `app/components/gallery/AgentCard.tsx` |

추가: `SafeImage.tsx`는 `import Image, { ImageProps } from 'next/image'`.

### 1-2. 일반 `<img` 태그 사용 여부

`<img` 매칭 **건수 상위** 기준으로 정렬한 상위 20개 파일(동일 파일 내 다수 태그 가능):

| 순위(대략) | 경로 | `<img` 매칭 수(파일당) |
|------------|------|------------------------|
| 1 | `app/admin/pending/components/AdminPendingDetailPanel.tsx` | 12 |
| 2 | `app/admin/overseas-content/OverseasContentAdminClient.tsx` | 4 |
| 3 | `app/admin/products/[id]/page.tsx` | 3 |
| 4 | `app/components/detail/DestinationGallery.tsx` | 2 |
| 5 | `app/components/home/PartnerOrgLogoCell.tsx` | 2 |
| 6 | `app/components/home/HomeMobileHubSeasonCarousel.tsx` | 1 |
| 7 | `app/components/travel/overseas/OverseasHero.tsx` | 1 |
| 8 | `app/components/travel/overseas/OverseasRegisteredProductsSection.tsx` | 1 |
| 9 | `app/admin/photo-pool/page.tsx` | 1 |
| 10 | `app/admin/products/page.tsx` | 1 |
| 11 | `app/admin/register/page.tsx` | 1 |
| 12 | `app/admin/convert-to-webp/page.tsx` | 1 |
| 13 | `app/admin/image-assets-upload/page.tsx` | 1 |
| 14 | `app/components/travel/reviews/TravelReviewCard.tsx` | 1 |
| 15 | `app/components/detail/HqBrandBadge.tsx` | 1 |
| 16 | `app/components/detail/DestinationHero.tsx` | 1 |
| 17 | `app/components/detail/ProductOfficialBadge.tsx` | 1 |
| 18 | `app/components/detail/ProductHeroCarousel.tsx` | 1 |
| 19 | `app/travel/overseas/private-trip/_components/OurTravelHero.tsx` | 1 |
| 20 | `components/products/ProductResultsList.tsx` | 1 |

참고: 요청하신 `<img src` 한 줄 패턴은 **9파일**만 매칭(멀티라인 `src` 등 누락 가능). 위는 `<img` 기준으로 범위를 넓힘.

### 1-3. 이미지 URL 패턴 추적

| 패턴 | 출처·용도 |
|------|-----------|
| **Supabase Storage 공개 URL** | `https://<project>.supabase.co/storage/v1/object/public/<bucket>/...` — `lib/object-storage.ts`의 `getPublicUrl`·`buildPublicUrlForObjectKey`, `home-hub-active.json`의 `trainingPageSecondaryImage`, `home-hub-candidates.json`의 `imagePath` 등. |
| **레거시 Ncloud** | `next.config.js`의 `remotePatterns`에 `*.object.ncloudstorage.com` 등. DB/과거 데이터 잔존용. |
| **외부 CDN(스톡)** | `picsum.photos`, `images.unsplash.com`, `images.pexels.com` — `next/image` 허용 목록에 명시. `lib/image-fallback.ts`에 Pexels URL 예시. |
| **상대 경로 `/images/...`** | `public/` 정적 자산, `home-hub-active.json`의 `images.training` 등. `lib/home-hub-images.ts` 폴백 `/images/home-hub/${season}/${key}.jpg`. |
| **메인 해외/국내 카드** | `pickHomeHubTravelCardCover` → `getHomeHubCoverImageUrl` — DB의 `bgImageUrl` 또는 일정 `imageUrl`에서 온 **임의 HTTPS/상대 URL**(런타임·DB 의존). |

**대표 추적 경로(메인):**

1. `app/page.tsx` → `getHomeHubActiveFile()` / `pickHomeHubTravelCardCover` → `HomeHubFour` / `HomeMobileHub`.
2. 카드 이미지 문자열은 `public/data/home-hub-active.json`의 `images`, `imageSourceModes`, 상품 풀 URL, 마지막으로 `homeHubCardImageSrc()` 정적 폴백으로 결정(`lib/home-hub-resolve-images.ts`, `lib/home-hub-card-hybrid-core.ts`).
3. Storage 업로드 결과 URL은 `SUPABASE_URL` + `/storage/v1/object/public/` + bucket + object key 형태로 고정(`lib/object-storage.ts`).

---

## 2. `next.config.js` 설정

파일: 프로젝트 루트 `next.config.js`.

| 항목 | 내용 |
|------|------|
| **`images`** | **`remotePatterns`만** 정의됨. `domains` 키는 **없음**(Next 14+ 권장: `remotePatterns`만 사용 중). |
| **`remotePatterns` (고정)** | `picsum.photos`, `images.unsplash.com`, `images.pexels.com`, `kr.object.ncloudstorage.com`, `**.object.ncloudstorage.com` (와일드카드 hostname). |
| **`remotePatterns` (동적)** | `SUPABASE_URL` 파싱 → `{ pathname: '/storage/v1/object/public/**' }`. `NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL` 파싱 → `{ pathname: '/**' }`. |
| **`formats`** | **미설정** → Next 기본(일반적으로 AVIF/WebP 협상은 기본 동작, 버전에 따름). |
| **`deviceSizes` / `imageSizes`** | **미설정** → Next 기본 배열 사용. |
| **`images.unoptimized` (전역)** | **미설정** → 전역 비최적화 아님. |
| **`loader`** | **미설정** → 기본 `default` loader. |

컴포넌트 단위로는 여러 곳에서 **`unoptimized={true}` 또는 원격 URL 시 `unoptimized`**를 켜는 패턴이 있음(§5 참고).

---

## 3. Supabase Storage 사용 방식

| 파일 | 역할 |
|------|------|
| `lib/supabase-admin.ts` | **Postgres(service role)**용 `createClient`. 주석상 이미지 바이너리는 Storage + Prisma 메타로 분리. **업로드/transform 없음.** |
| `lib/object-storage.ts` | **이미지 Storage의 SSOT**: bucket(`SUPABASE_IMAGE_BUCKET` 기본 `bongtour-images`), `getPublicUrl`, `upload`(`contentType`, `upsert: true`). |

**업로드 시 transform 옵션:** `upload` 호출에 **이미지 리사이즈·포맷 변환 옵션 없음**(원본 바이너리 그대로 `upsert`).

**`getPublicUrl`:** 표준 SDK 형태 — **쿼리 변환 파라미터(예: width) 없음**. 공개 URL은 객체 키 기준 직링크.

**기타:** `lib/private-trip-hero-direct-upload-server.ts`, `lib/monthly-curation-direct-upload-server.ts` 등은 **signed upload URL** 패턴(직접 업로드 플로우). 역시 Storage **변환 API**에 의존하는 코드는 본 스캔 범위에서 확인되지 않음.

---

## 4. 대표 이미지 URL 목록 (크기 측정용 · 마스킹 없음)

아래는 **저장소에 실제로 문자열로 존재하는** URL 예시(운영 DB·랜덤 풀 URL은 환경별로 다름).

1. `https://spuptilbzyxrvyyyheza.supabase.co/storage/v1/object/public/bongtour-images/home-hub/candidates/training-spring-1776136505480-sd9f0a-3.webp`  
   - `public/data/home-hub-active.json` → `trainingPageSecondaryImage` (동일 파일명이 `home-hub-candidates.json`에도 다수).

2. `https://spuptilbzyxrvyyyheza.supabase.co/storage/v1/object/public/bongtour-images/home-hub/candidates/training-spring-1776136505480-sd9f0a-0.webp`  
   - `public/data/home-hub-candidates.json` 후보 경로 예시.

3. `https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1920`  
   - `lib/image-fallback.ts`에 정의된 폴백 URL.

4. `https://www.bongtour.com/images/home-hub/mobile/overseas.jpg`  
   - **배포 오리진이 `https://www.bongtour.com`일 때** `public/images/home-hub/mobile/overseas.jpg`에 대응하는 절대 URL(로컬이면 `http://localhost:3000/images/home-hub/mobile/overseas.jpg`).

5. `https://www.bongtour.com/images/home-hub/mobile/private-trip.webp`  
   - 동일하게 `public/images/home-hub/mobile/private-trip.webp` 기준 절대 URL 예시.

참고: `home-hub-active.json`의 `/images/home-hub/candidates/...` 및 `base/bus.jpg`는 **현재 워크스페이스 `public/` 트리에 해당 파일이 없을 수 있음**(JSON만 있고 바이너리 미동기화 시 404). 메인 런타임 URL은 **JSON·DB·풀**에 따라 달라짐.

---

## 5. 최적화 적용 현황

### Lazy loading

- **`<img loading="lazy"`:** 예) `app/admin/image-assets-upload/page.tsx`, `app/components/home/HomeMobileHubSeasonCarousel.tsx`(원격 `https`일 때 `<img>` 분기).
- **`next/image`:** 기본적으로 뷰포트 기반 지연 로딩 동작(Next 기본). 명시 `loading="lazy"`는 제한적으로 사용.

### `priority` (히어로·Above the fold)

- **메인 데스크톱 허브 카드:** `HomeHubFourClientCard.tsx` — `priority={index < 2}` (상위 2카드만).
- **모바일 메인 타일:** `HomeMobileHub.tsx` — `priority={index < 4}` (4타일 모두 우선 로드에 가깝게 설정).

### Placeholder (blur 등)

- 스캔 상 **`placeholder="blur"` + `blurDataURL` 조합은 흔치 않음**. `SafeImage`는 로드 실패 시 **색 블록 UI**로 대체.
- `next/image`의 `placeholder` prop 적극 사용 패턴은 **제한적**으로 보임.

### 반응형 `sizes`

- **사용 예:** `HomeHubFourClientCard`(`sizes` 문자열 지정), `HomeMobileHub` 타일, `CharterBusLanding`, `HomeHubImageCandidateGrid`, `OverseasMonthlyCurationMid` 등.
- **일부 `<img>`:** `sizes` 없음(브라우저 기본만).

### `unoptimized` (최적화 우회)

- **`SafeImage.tsx`:** 항상 `unoptimized` → **next/image 최적화 파이프라인 비활성**.
- **원격 `http(s)` URL:** `HomeHubFourClientCard`, `HomeMobileHub`, `TrainingHub`, 관리자 그리드 등에서 **`unoptimized={url이 https로 시작}`** 형태로 **원격은 전부 비최적화**인 경우가 많음.
- **`HomeMobileHubSeasonCarousel`:** 원격은 `<img>`로 분기 + `loading="lazy"`; 로컬 경로는 `next/image` + `unoptimized`가 `/`로 시작해도 true가 되는 로직(`imageUnoptimized`)이 있어 **상대 경로도 비최적화** 가능.

---

## 6. 병목 후보 (우선순위)

1. **원격(특히 Supabase 공개 URL)에 대해 `unoptimized`를 켜는 패턴** — 대역·디코딩 비용이 클라이언트에 그대로 전가되고, **Next 이미지 최적화·포맷 협상 이득이 사라짐**. 메인 허브·모바일 타일이 해당.
2. **`SafeImage` 전역 `unoptimized`** — 갤러리·썸네일 등에서 재사용 시 동일.
3. **원본 해상도 업로드(`object-storage`에 리사이즈 없음)** — 히어로에 큰 WebP/PNG를 그대로 쓰면 **LCP·메모리** 부담.
4. **동일 메인에서 `priority`가 모바일 4타일까지 true** — 의도적이더라도 **경쟁 다운로드**로 LCP 후보가 흐려질 수 있음.
5. **`<img>` + 외부 URL** (시즌 캐러셀 원격 분기) — `decoding="async"`는 있으나 **srcset/`sizes` 없음** → 모바일에 큰 원본 전송 위험.

---

## 7. 해결 제안 (단계별)

### Phase 1 — 관측·저위험

- Chrome DevTools **Network → Img**, **LCP element**로 메인에서 실제 응답 **바이트 수·MIME** 측정(위 §4 URL로 재현 가능).
- `next/image` **원격 `unoptimized` 제거 가능 여부**를 검토: Supabase가 **이미 WebP·적정 해상도**를 보장하는지 확인 후, `remotePatterns` 범위 내에서 **최적화 파이프라인 활성화** 시도.

### Phase 2 — 업로드·아키텍처

- 업로드 파이프라인에서 **최대 변 길이·품질 고정**(서버에서 sharp 등으로 리사이즈 후 Storage 저장) — `object-storage.ts` 책임 확장.
- 히어로·카드용 **전용 해상도 프리셋**(예: 2x DPR 기준 max width) 정의.

### Phase 3 — UI 패턴

- **LCP 1장만 `priority`**, 나머지는 lazy + 명시 `sizes`로 **대역 절약**.
- `placeholder="blur"`는 **LCP 후보 1개**에만 적용 검토(빌드 시 `blurDataURL` 생성 비용 고려).
- 시즌 캐러셀 원격 이미지를 **`next/image` + 적절 `sizes`**로 통일할지, **이미지 프록시 API**로 갈지 선택.

---

*본 문서는 코드 수정 없이 진단 목적으로만 작성됨.*
