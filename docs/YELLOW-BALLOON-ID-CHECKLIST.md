# 노랑풍선 식별값 판별 체크리스트

**목표**: `originCode` · `supplierGroupId` · `supplierDepartureCode` 를 **서로 다른 역할**로 분리 판별한다.

**원칙**

- 화면에 보이는 상품번호를 곧바로 `originCode`로 확정하지 않는다.
- 반드시 **URL / 내부 스크립트 / XHR·fetch 응답 / 출발일 리스트 row** 기준으로 확인한다.
- 식별값 역할이 다르면 **같은 문자열이어도 필드를 분리**한다.

---

## 1. 상세 URL 확인

- [ ] 상품 상세 URL에 대표 상품 코드처럼 보이는 **파라미터**가 있는가?
- [ ] **path segment** 또는 **query param**에 상품 대표 식별값 **후보**가 있는가?
- [ ] 이 값이 **출발일을 바꿔도 유지**되는가?
- [ ] 유지된다면 **originCode 후보 우선순위**를 높인다.

---

## 2. 화면 상품번호 확인

- [ ] 화면에 노출된 상품번호가 있는가?
- [ ] 이 값이 **날짜가 바뀌어도 같은가**, 아니면 **날짜 포함 형태**로 바뀌는가?
- [ ] 날짜·편명·옵션 정보가 섞여 있으면 대표 상품 코드(`originCode`)보다 **`supplierGroupId` 또는 `supplierDepartureCode` 후보**일 수 있다.
- [ ] 화면 노출용 **마케팅 코드**일 가능성도 배제하지 않는다.

---

## 3. 내부 스크립트 확인

- [ ] 상세 페이지 HTML·script 안에 `productId` / `goodsCd` / `masterCode` / `packageCode` / `tourCode` 류 값이 있는가?
- [ ] 페이지 초기 데이터 객체(`window.__INITIAL_STATE__`, `__NEXT_DATA__`, inline JSON 등)가 있는가?
- [ ] 여기서 발견되는 값이 **URL·화면 상품번호**와 일치하는가?
- [ ] 여기서 발견되는 **대표 식별값**은 **originCode SSOT 후보**로 기록한다.

---

## 4. 출발일 팝업 XHR / fetch 확인

- [ ] 팝업을 열 때 **어떤 요청**이 나가는가?
- [ ] 요청 파라미터에 **상품 대표 식별값**이 있는가?
- [ ] **월 이동** 시에도 같은 대표 식별값이 **계속 쓰이는가?
- [ ] row 리스트 응답에 **출발 행 전용 식별값**이 따로 있는가?

---

## 5. 출발일 리스트 row 확인

- [ ] 우측 리스트 각 행에 **hidden 값** / `data-*` / `onclick` parameter / **링크 파라미터**가 있는가?
- [ ] **행마다 달라지는 값**이 있으면 `supplierDepartureCode` **후보**로 본다.
- [ ] 행별 코드가 **날짜 + 가격 + 상태**와 함께 움직이면 **departure row 식별자**로 적합하다.

---

## 6. 역할 분리 판정 (정의)

| 키 | 역할 |
|----|------|
| **originCode** | 대표 상품 식별값. 상품 상세 **전체**를 대표하고, **월을 바꿔도 유지**되는 값. |
| **supplierGroupId** | 공급사 내부 **묶음·동기화 보조** 키. 화면 상품번호 또는 내부 그룹 코드일 수 있음. |
| **supplierDepartureCode** | **출발일 row 단위** 식별값. 특정 날짜·행에만 붙는 코드. |

---

## 7. 최종 판정 규칙

- 대표 상품 전체를 **안정적으로 대표**하면 → **originCode**
- 본사·공급사 내부 **묶음·동기화 보조** 의미가 강하면 → **supplierGroupId**
- **특정 출발 행에만** 붙으면 → **supplierDepartureCode**
- 셋이 **동일 문자열**일 수도 있지만, **역할이 다르면 필드를 분리 유지**한다.

---

## 8. 금지

- 화면 상품번호를 **아무 검증 없이** `originCode`로 확정
- **row 식별값**을 `originCode`에 덮어쓰기
- `supplierGroupId`와 `supplierDepartureCode`를 **구분 없이** 하나로 저장

---

**관련**

- [YELLOW-BALLOON-ADAPTER-DESIGN.md](./YELLOW-BALLOON-ADAPTER-DESIGN.md)
- [YELLOW-BALLOON-F12-CHECKLIST.md](./YELLOW-BALLOON-F12-CHECKLIST.md) — DevTools 실측 절차
