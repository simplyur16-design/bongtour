# 메인 4허브 카드 배경 이미지 운영

**관리자 UI 와이어·A~E 화면 구조:** [`ADMIN-HOME-HUB-IMAGES-UI.md`](./ADMIN-HOME-HUB-IMAGES-UI.md)

## `home-hub-active.json` 필드 (Phase 1)

| 필드 | 설명 |
|------|------|
| `activeSeason` | 운영 시즌 (`default` \| `spring` \| `summer` \| `autumn` \| `winter`). 레거시 `season` 폴백 지원. |
| `lastUpdatedAt` | ISO 8601, 활성 저장 시 갱신 권장. |
| `lastUpdatedBy` | 선택, 관리자 식별. |
| `images` | `overseas` 등 키별 공개 URL. |

메인 노출 URL은 여전히 `resolveHomeHubImageSrc()` 가 `images[key]` 를 우선한다.

## 원칙

- 사용자 메인에서 **제미나이(또는 외부 API)로 매 요청마다 생성하지 않는다.**
- **관리자에서 후보를 생성 → 미리보기 → 하나를 활성화**하는 흐름을 전제로 한다.
- 이미지는 **파일 저장소(또는 CDN) + 메타데이터**로 관리한다.

## 현재 구현 (Phase 1)

- 활성 이미지 URL은 `public/data/home-hub-active.json` 에서 읽는다.
- 키: `overseas` | `training` | `domestic` | `bus`
- 값: `/images/...` 형태의 공개 경로(권장) 또는 `https://...`(이 경우 `next.config.js` `images.remotePatterns` 등록 필요).
- 코드: `lib/home-hub-resolve-images.ts` 의 `resolveHomeHubImageSrc()` 가 메인 허브 카드에 적용된다.
- 관리자 화면: `/admin/home-hub-card-images` — 현재 JSON 요약·운영 절차 안내.

## 권장 Phase 2 — DB 테이블 `home_hub_card_images`

| 컬럼 | 설명 |
|------|------|
| `id` | PK |
| `card_key` | `overseas` / `training` / `domestic` / `bus` |
| `season` | `spring` / `summer` / `autumn` / `winter` / `default` |
| `prompt_text` | 생성에 사용한 프롬프트 |
| `image_path` | 저장 경로 또는 CDN URL |
| `is_selected` | 후보 중 운영자가 고른 컷 |
| `is_active` | 메인에 노출 중인 1장 (카드·시즌당 최대 1) |
| `created_at` / `updated_at` | 감사 |

### 운영 흐름

1. 관리자 UI에서 카드·시즌 선택 후 제미나이로 **2~4장 후보** 생성.
2. 썸네일 목록에서 미리보기.
3. **활성화** 시 해당 행만 `is_active=true`, 동일 `card_key`+`season` 의 나머지는 `false`.
4. 공개 메인은 **활성 행의 `image_path`만** 조회 (서버 캐시 가능).

### JSON과의 관계

- Phase 2 도입 후에도 배포 단순화를 위해 **빌드/배치가 JSON을 갱신**하는 방식을 병행할 수 있다.
- 또는 API `GET /api/public/home-hub-images` 가 DB를 읽고, 메인은 해당 API 결과를 사용.

## 이미지 품질

- 텍스트·워터마크 없음.
- 카드 중앙에 타이포 여백이 있는 구도.
- 카테고리별·시즌별 톤 차이는 `docs`의 메인 기획 문구와 `public/images/home-hub/README.md` 를 참고.
