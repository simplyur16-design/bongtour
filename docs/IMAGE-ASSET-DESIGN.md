# 봉투어 이미지 자산 저장/재사용/갱신 구조 설계

## 1) 이미지 자산 재사용 구조가 필요한 이유

- **현재**: 등록대기에서 상품마다 Pexels 검색·Gemini 생성으로 대표 이미지를 확보하고, `Product.bgImageUrl`에만 저장한다. 같은 도시(다낭, 오사카)나 같은 관광지(바나힐, 내원교)를 쓰는 상품이 많아도 매번 새로 검색/생성하는 구조에 가깝다.
- **문제**: (1) 동일 도시·관광지 이미지를 반복 생성/검색해 비용·시간이 낭비되고, (2) 품질이 승인된 자산을 재사용할 수 없으며, (3) Gemini를 “상시 생성 도구”처럼 쓰게 되어 비효율적이다.
- **목표**: “상품 전용 → 관광지 자산 → 도시 자산 → Pexels → Gemini” 순으로 **재사용 우선**하고, Gemini는 신규·리프레시 등 **보조 용도**로만 쓰도록 한 구조로 정리한다.
- **제약**: 고객 노출의 단일 진입점은 **Product.bgImageUrl**을 유지한다. 자산 계층은 “어떤 URL을 bgImageUrl에 채울지”를 결정하는 소스로만 쓰고, 기존 갤러리/featured/상세 반영 규칙은 바꾸지 않는다.

---

## 2) 추천 데이터 구조

- **추천: C. 혼합 구조**
  - **Product**: 기존처럼 `bgImageUrl` + 메타(bgImageSource, bgImagePhotographer, bgImageSourceUrl, bgImageExternalId) 유지. “이 상품에 확정된 대표 이미지 URL”을 담는 **최종 저장소**로 둔다.
  - **도시/관광지 재사용 자산**: 이미 있는 **DestinationImageSet**(도시별 메인+일정 세트), **PhotoPool**(도시+명소별 업로드)를 **도시·관광지 레벨 자산**으로 정의하고, “상품에 이미지가 없을 때 여기서 후보를 가져와 채우거나, 관리자가 선택해 Product에 저장”하는 흐름으로 활용한다.
  - **신규 테이블(선택·후속)**: “승인된 대표 이미지 후보만 모아서 재사용”을 명시적으로 쓰고 싶다면, **ImageAsset** 같은 별도 테이블을 나중에 추가해 **city / attraction** 레벨만 넣고, product 레벨은 계속 Product.bgImageUrl로만 둔다.

- **지금 단계에서 새 테이블을 만들지 않는 이유**
  - DestinationImageSet(도시별 메인+일정), PhotoPool(도시+명소)이 이미 “도시·관광지 단위 자산” 역할을 하고 있음.
  - 우선 **우선순위 규칙과 조회 로직**만 정리해, “상품 대표 이미지 결심 시 Product.bgImageUrl에 무엇을 넣을지”를 일관되게 하면, 재사용 효과를 낼 수 있음.
  - ImageAsset은 “승인 플래그·사용 이력·갱신 주기” 등을 도입할 때 함께 추가하는 편이 유리함.

- **ImageAsset을 나중에 도입할 때의 최소 필드 제안**
  - **지금 단계에서 꼭 필요**: id, assetLevel(city|attraction), scopeKey(도시명 또는 `도시명|관광지명`), imageUrl, imageSource(pexels|gemini|manual), photographer?, sourceUrl?, externalId?, isApproved, createdAt.
  - **후속으로 미뤄도 됨**: tags, season, styleType, usageCount, lastUsedAt(재사용 이력·피로도는 2단계에서).

---

## 3) 자산 계층(level) 정의

| 레벨 | 의미 | 현재 스키마 대응 | 용도 |
|------|------|------------------|------|
| **city** | 도시/목적지 단위 (다낭, 오사카, 방콕 등) | DestinationImageSet.destinationName, PhotoPool.cityName, Destination | 해당 도시를 쓰는 **모든 상품**에 재사용 가능한 메인/일정 이미지. 상품에 전용 이미지가 없을 때 1순위 후보. |
| **attraction** | 관광지/명소 단위 (바나힐, 내원교, 오사카성 등) | PhotoPool.attractionName (cityName+attractionName 조합) | 특정 관광지를 포함하는 상품의 대표/일정 이미지 후보. 도시보다 구체적이므로 매칭되면 우선 사용. |
| **product** | 상품 전용 | Product.bgImageUrl + 메타 | 해당 상품에만 붙은 “확정” 대표 이미지. 관리자가 Pexels/Gemini/수동 중에서 선택해 저장한 값. 재사용 계층보다 우선. |

- **매칭 규칙 요약**
  - **product**: 해당 Product 레코드에 bgImageUrl이 있으면 그대로 사용(최우선).
  - **attraction**: 상품의 destination·일정·2차 분류 등에서 추출한 “관광지명”과 PhotoPool(cityName + attractionName) 매칭. 하나라도 있으면 그 중 메인 슬롯을 대표 후보로 제안.
  - **city**: 상품의 destination(도시명)과 DestinationImageSet.destinationName 또는 PhotoPool.cityName 매칭. 메인 1장을 대표 후보로 제안.

---

## 4) 대표 이미지 선택 우선순위 최종안

상품의 **대표 이미지 1장**을 정할 때, 아래 순서로 “후보 URL”를 정하고, **최종적으로 선택된 URL은 항상 Product.bgImageUrl(및 메타)에만 저장**한다.

1. **상품 전용 승인 이미지**  
   `Product.bgImageUrl`이 이미 있으면 그대로 사용. (관리자가 이전에 Pexels/Gemini/수동으로 선택해 둔 값.)
2. **관광지 승인 자산**  
   상품 destination + 일정/테마에서 추정한 관광지명으로 PhotoPool(cityName + attractionName)에서 메인 슬롯(sortOrder 0) 조회. 있으면 그 URL을 후보로 사용(또는 관리자에게 “이미지 제안”으로 보여 준 뒤 선택 시 Product에 저장).
3. **도시 승인 자산**  
   destination(도시명)으로 DestinationImageSet.mainImageUrl 또는 PhotoPool에서 해당 도시 메인 1장 조회. 있으면 후보로 사용.
4. **Pexels 검색**  
   등록대기 패널에서 “Pexels 검색”으로 받은 결과 중 관리자가 선택한 URL을 Product에 저장. (기존 흐름 유지.)
5. **Gemini 생성**  
   Pexels로 충분한 결과가 없을 때만 “Gemini 생성”으로 후보 생성 후, 관리자가 선택한 URL을 Product에 저장. (보조/리프레시.)

- **bgImageUrl과의 연결**
  - 갤러리/featured/상세는 **오직 Product.bgImageUrl**(및 필요 시 메타)만 참조한다.
  - “자산 조회”는 **등록대기 또는 process-images 등에서 “이 상품에 넣을 URL을 정할 때”**만 사용한다.  
  - 정해진 URL은 **반드시 Product.bgImageUrl(및 메타)에 한 번 더 저장**하는 구조이므로, 기존 노출 로직은 전혀 바꿀 필요가 없다.

---

## 5) 갱신 정책 제안

- **Gemini/Pexels 재생성·재선정을 하는 경우(권장)**
  - **신규 등록 상품**: 대표 이미지가 비어 있을 때 위 1→2→3→4→5 순서로 후보를 채우고, 없으면 Pexels → 부족 시 Gemini.
  - **메인/노출 상품이 오래된 경우**: 예) 메인 베너/갤러리 상단 노출 상품 중 “대표 이미지 갱신일”이 N개월 지났으면, 관리자에게 “리프레시 제안”만 하거나, 배치에서 도시/관광지 자산으로 덮어쓰기 옵션 제공.
  - **계절/시즌 변경**: 계절성 상품(예: 스키, 휴양)은 시즌 전에 도시/관광지 자산을 한 번 점검하고, 필요 시에만 Pexels/Gemini로 보강.
- **하지 않는 것**
  - **전 상품에 대한 정기 자동 생성**은 하지 않는다. 비용·부하 대비 효율이 낮고, 재사용 우선이면 도시/관광지 자산으로 대부분 커버 가능하다고 보는 것이 맞다.

- **Gemini fallback 정책**
  - Gemini는 **상시 생성 기본 경로가 아니다.** 자산 재사용·Pexels를 먼저 쓰고, 부족할 때만 보조로 사용.
  - **용도**: (1) 신규 등록 시 자산·Pexels로 채우기 어려울 때, (2) 이미지 리프레시 시 기존 이미지 교체가 필요할 때. 공급사 원문/일정을 바꾸는 데 쓰지 않고, **대표 이미지 보조 수단**으로만 사용.
  - **저장**: 선택 시 `bgImageSource = 'gemini'` 및 메타 구조 유지.
  - **운영 주의**: 과도하게 자주 생성하지 않도록, 등록대기 패널에서는 “Gemini 생성 (보조)” 문구·툴팁으로 우선순위를 안내한다. (후속: 주기적 생성 방지 가이드·쿼터 검토.)

---

## 6) MVP로 먼저 구현할 최소안

- **지금 봉투어에 가장 현실적인 방법**: **새 테이블 없이**, 기존 Product + DestinationImageSet + PhotoPool만으로 **“선택 우선순위”와 “재사용”을 문서·로직으로 정리**하는 것.

- **MVP 범위**
  1. **문서화**: 이 설계안(IMAGE-ASSET-DESIGN.md)으로 “도시 → 관광지 → 상품” 계층과 1→2→3→4→5 우선순위를 고정.
  2. **등록대기 패널 동작 유지**: Pexels 검색 → Gemini 생성(보조) → “대표 이미지로 선택” 시 기존처럼 Product PATCH(bgImageUrl + 메타)만 사용.
  3. **process-images(또는 동일 로직) 보강**: 상품 대표 이미지가 비어 있을 때,  
     - PhotoPool(도시+관광지) → DestinationImageSet(도시) 순으로 **대표 후보 1장**을 찾고,  
     - 있으면 그 URL을 Product.bgImageUrl(및 메타)에 자동 반영하는 옵션을 두거나,  
     - “등록대기에서 도시/관광지 자산 후보를 보여 주고, 관리자가 선택해 저장”하는 작은 플로우 하나 추가.
  4. **UI 추가는 최소**: “도시/관광지 자산에서 가져오기” 버튼 하나만 있어도 됨. 클릭 시 해당 상품의 destination(및 일정)으로 PhotoPool·DestinationImageSet 조회 후, 후보 1~3장을 보여 주고, 선택 시 기존 PATCH로 Product에 저장.

- **정리**
  - **MVP에서는 ImageAsset 테이블을 만들지 않고**, DestinationImageSet + PhotoPool을 “도시/관광지 자산”으로 정의한 뒤, “상품에 이미지 없을 때 여기서 가져와 Product.bgImageUrl에 채우는” 규칙만 도입하는 것을 추천한다.
  - 이후 “승인 플래그·사용 횟수·갱신 주기”가 필요해지면 그때 ImageAsset(또는 동일 역할 테이블)을 추가하고, 기존 DestinationImageSet/PhotoPool 데이터를 마이그레이션하거나, 두 체계를 병행해도 된다.

---

## 7) 후속 확장 TODO

- **ImageAsset 테이블 도입(선택)**  
  - assetLevel(city|attraction), scopeKey, imageUrl, imageSource, isApproved, usageCount, lastUsedAt 등.  
  - Product.bgImageUrl은 그대로 “최종 확정값”만 저장하고, “후보 풀”만 ImageAsset으로 관리.
- **재사용 이력**  
  - 같은 URL이 여러 상품에 쓰일 때 usageCount 증가, lastUsedAt 갱신.  
  - “너무 많이 쓰인 이미지”는 관리자 화면에서 피로도 표시 후 교체 후보 제안.
- **갱신 주기**  
  - “대표 이미지 갱신일”을 Product에 두거나, ImageAsset.lastUsedAt 기준으로 “N개월 미사용” 자산 리프레시 제안.
- **등록대기 “도시/관광지 자산에서 가져오기”**  
  - destination + (선택) 관광지 키워드로 PhotoPool·DestinationImageSet 조회 API 하나,  
  - 패널에서 후보 표시 후 “대표 이미지로 선택” 시 기존 PATCH 재사용.

---

## 8) 도시/관광지 자산에서 가져오기 (구현)

- **API**: `GET /api/admin/image-assets/suggest?productId=...`  
  - 상품의 `destination`(도시명)으로 DestinationImageSet 1건 + PhotoPool N건 조회.  
  - 응답: `{ ok, cityCandidates, attractionCandidates }` (각 항목: imageUrl, source, photographer?, sourceUrl?, externalId?, label).  
  - 총 1~6장 내외(도시 3 + 관광지 3).
- **패널**: “도시/관광지 자산에서 가져오기” 버튼 → 후보 그리드 → “대표 이미지로 선택” 시 기존 Product PATCH(primaryImageUrl → bgImageUrl) 재사용.
- **메타 저장**: 선택한 후보의 출처에 따라 Product에 다음처럼 저장한다.
  - **destination-set**: DestinationImageSet 메인 이미지. `bgImageSource = 'destination-set'`, photographer/sourceUrl은 mainImageSource JSON에서.
  - **photopool**: PhotoPool 이미지. `bgImageSource = 'photopool'`, photographer는 Pool의 source, sourceUrl은 비움, externalId는 PhotoPool.id(추적용).
  - (선택) **city-asset** / **attraction-asset**: 나중에 구분이 필요하면 source 값을 이렇게 세분화해 저장할 수 있음.

---

## 9) 목적지 정규화 및 관광지 키워드 (안전한 보강)

- **원칙**: 이 로직은 **이미지 자산 추천용 내부 정규화**이며, **Product.destination·title 등 상품 원문/일정 데이터는 절대 수정·덮어쓰지 않는다.** 공급사 원문은 그대로 두고, 조회 시에만 정규화된 키로 자산을 찾는다.
- **목적지 정규화** (`lib/destination-normalize.ts`)
  - `destination` 문자열을 구분자(`,`, `/`, `·`, `|`)로 분리해 여러 도시 후보로 만든 뒤, 한글/영문 별칭을 **조회용 대표 키**(한글)로 매핑.
  - 예: `다낭`, `Da Nang` → `다낭`; `호이안/다낭` → `['호이안','다낭']`. 정규화 결과는 API 내부 변수로만 사용하고, DB 원문은 변경하지 않음.
- **관광지 키워드** (`lib/attraction-keywords.ts`)
  - **원문(title·destination)에 명시적으로 등장하는** 관광지명만 사용. 허용 목록(바나힐, 내원교, 오사카성 등)에 있는 문자열이 원문에 **포함**되어 있을 때만 PhotoPool.attractionName 매칭에 사용.
  - 원문에 없는 관광지를 추론·상상하지 않음. “원문에 보이면 매칭, 안 보이면 안 씀.”
- **suggest API**: 정규화된 도시 키 배열로 DestinationImageSet·PhotoPool 순차 조회, 추출된 관광지 키워드가 있으면 해당 attraction 후보를 우선 노출.

---

## 10) 등록대기 패널 실전 플로우 및 source 저장 규칙

- **UI 구분**: 후보를 **관광지 자산** / **도시 자산** 두 섹션으로 나눠 표시. 뒤섞이지 않게 하고, 관광지(우선순위 2)를 위에, 도시(우선순위 3)를 아래에 둔다.
- **라벨**: API가 내려주는 `label` 그대로 사용. 예: `도시 대표 (다낭)`, `관광지: 바나힐`, `도시 사진 풀 (다낭)`.
- **저장 규칙**: “대표 이미지로 선택” 시 기존 Product PATCH(primaryImageUrl → bgImageUrl)만 사용. `primaryImageSource`에는 API 후보의 `source` 값을 그대로 저장.
  - `source === 'destination-set'` → `bgImageSource = 'destination-set'`
  - `source === 'photopool'` → `bgImageSource = 'photopool'`
  - photographer, sourceUrl, externalId는 후보 객체 값 그대로 전달.
- **후속 TODO**: process-images 등 자동 채움 로직에서도 동일 우선순위(상품 전용 → 관광지 자산 → 도시 자산 → Pexels → Gemini)를 사용하도록 보강. suggest API 또는 동일 정규화·조회 로직을 재사용해 1장 후보를 정한 뒤, 옵션으로 Product.bgImageUrl에 자동 반영.
